from openai import OpenAI
import json
import os
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Patterns that are normal in Maharashtra L&L — never red flags ──
EXCLUDE_PATTERNS = [
    "stamp duty and registration fees",
    "borne by the licensee and licensor equally",
    "double the daily amount of compensation",
    "reasonable notice",
    "no tenancy",
    "shall not claim any tenancy",
    "lock-in period",
    "subletting",
    "sub-let",
]

def is_false_positive(clause_text: str) -> bool:
    text = clause_text.lower()
    return any(pattern in text for pattern in EXCLUDE_PATTERNS)

def calculate_score(result: dict, clean_text: str) -> float:
    """Start at 10, deduct only. No bonuses — compliance is the baseline."""
    score = 10.0

    severity_deductions = {"HIGH": 1.5, "MEDIUM": 1.0, "LOW": 0.5}
    for flag in result.get("red_flags", []):
        score -= severity_deductions.get(flag.get("severity", "").upper(), 0)

    for _ in result.get("discriminatory_clauses", []):
        score -= 3.0

    for _ in result.get("missing_clauses", []):
        score -= 0.75

    return round(max(1.0, min(10.0, score)), 1)

COMPULSORY_FINANCIALS = {
    "monthly_rent": (
        "Monthly Rent Amount",
        "IGR Clause 4.3",
        "Without a stated rent amount the agreement is legally incomplete and unenforceable."
    ),
    "security_deposit": (
        "Security Deposit Amount",
        "IGR Clause 4.2",
        "Without a deposit amount there is no basis for refund disputes or deductions."
    ),
    "notice_period": (
        "Notice Period",
        "IGR Clause 4.9",
        "Without a notice period either party can demand immediate vacation with no legal recourse."
    ),
    "lock_in_period": (
        "Lock-in Period",
        "IGR Clause 4.5",
        "Without a lock-in period the licensor can ask you to vacate at any time without penalty."
    ),
    "stamp_duty_borne_by": (
        "Stamp Duty Responsibility",
        "IGR Clause 4.12",
        "Without clarity on stamp duty responsibility disputes over registration costs are common."
    ),
}

def check_compulsory_financials(result: dict) -> dict:
    financials = result.get("financials", {})
    missing = result.get("missing_clauses", [])
    
    for field, (clause_name, igr_ref, why) in COMPULSORY_FINANCIALS.items():
        val = financials.get(field)
        if not val or val.lower() in ("null", "n/a", "none", "not mentioned", "not specified"):
            # Only add if not already flagged
            already_flagged = any(clause_name.lower() in m["clause"].lower() for m in missing)
            if not already_flagged:
                missing.append({
                    "clause": clause_name,
                    "igr_reference": igr_ref,
                    "why_it_matters": why
                })
    
    result["missing_clauses"] = missing
    return result

COMPULSORY_CLAUSE_CHECKS = [
    ("Maintenance Responsibility",   "IGR Clause 4.4",  "Without this clause it is unclear who is responsible for repairs — a common dispute source.",                          ["maintenance", "upkeep", "repair"]),
    ("Entry and Inspection Rights",  "IGR Clause 4.8",  "Without this clause the licensor has no defined right of entry — or unlimited entry rights by default.",              ["inspect", "inspection", "entry", "enter", "access"]),
    ("Subletting Prohibition",       "IGR Clause 4.7",  "Without this clause the licensee may be able to sublet the premises without restriction.",                            ["sublet", "sub-let", "subletting", "assign", "transfer"]),
    ("Vacation of Premises on Expiry","IGR Clause 4.11","Without this clause there is no explicit obligation on the licensee to vacate on expiry.",                            ["vacate", "vacation", "expiry", "expiration", "handover"]),
    ("Mandatory Registration",       "IGR Clause 4.12", "Unregistered agreements are not admissible as evidence in court.",                                                    ["register", "registration", "stamp duty", "stamp office"]),
    ("Two Witnesses",                "IGR Clause 4.15", "Without two witnesses the agreement may not be legally enforceable.",                                                  ["witness", "witnesses"]),
    ("Lock-in Period","IGR Clause 4.5", "Without a lock-in period the licensor can ask you to vacate at any time without penalty.", ["lock-in", "lock in", "lockin", "first 9 months", "first 6 months", "first 11 months", "shall not terminate", "shall not vacate"]),
    ("No Tenancy Rights Clause",     "IGR Clause 4.6",  "Without this clause the licensee could potentially claim tenancy rights over time.",                                  ["tenancy", "tenant", "tenancy rights"]),
]

PRESENCE_OVERRIDES = {
    "inspect":    ["entry and inspection", "licensor right to inspect"],
    "cancel":     ["cancellation", "cancellation and notice"],
    "terminat":   ["cancellation", "cancellation and notice"],
}

def detect_missing_clauses(clean_text: str, ai_missing: list) -> list:
    text = clean_text.lower()
    missing = []
    seen = set()

    # Layer 1 — deterministic keyword check
    for clause_name, igr_ref, why, keywords in COMPULSORY_CLAUSE_CHECKS:
        if not any(kw in text for kw in keywords):
            missing.append({
                "clause": clause_name,
                "igr_reference": igr_ref,
                "why_it_matters": why
            })
            seen.add(clause_name.lower())

    # Layer 2 — LLM additions, filtered for false positives
    for item in ai_missing:
        name = item.get("clause", "").lower()

        # Skip if already caught by keyword check
        if any(s in name or name in s for s in seen):
            continue

        # Skip if the topic is clearly present in the document text
        skip = False
        for doc_kw, clause_names in PRESENCE_OVERRIDES.items():
            if any(cn in name for cn in clause_names) and doc_kw in text:
                skip = True
                break

        if not skip:
            missing.append(item)
            seen.add(name)

    return missing

def analyze_agreement(clean_text: str, gold_standard: dict) -> dict:

    compulsory_names = [c["name"] for c in gold_standard["compulsory_fields"]]
    red_flag_patterns = [r["pattern"] for r in gold_standard["red_flag_patterns"]]
    discriminatory_patterns = [p["pattern"] for p in gold_standard.get("discriminatory_patterns", [])]
    standard_values = gold_standard["standard_values"]

    prompt = f"""You are a strict legal analyst specializing in Maharashtra Leave and License Agreements (India).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL INSTRUCTION — READ BEFORE ANALYZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before flagging ANY clause as missing, you MUST search the entire agreement text carefully.
A clause counts as PRESENT if its substance is addressed ANYWHERE in the agreement — even if
the heading, wording, or clause number differs from the standard name.

Examples of what counts as PRESENT:
- "Date and Location of Execution" → PRESENT if a date and location appear anywhere in the agreement header
- "Licensor Full Details" → PRESENT if licensor name, age, address are listed anywhere
- "Licensee Full Details" → PRESENT if licensee name, age, address are listed anywhere
- "Property Schedule" → PRESENT if a Schedule I or property description appears anywhere
- "Two Witnesses with UID" → PRESENT if witness names/addresses are listed anywhere
- "Maintenance Charges" → PRESENT if any clause assigns maintenance responsibility
- "Lock-in Period" → PRESENT if lock-in duration is mentioned anywhere
- "Subletting" → PRESENT if subletting or assignment is addressed anywhere
- "Inventory List" → PRESENT if a Schedule II with furniture/appliances is listed

Only flag a clause as MISSING if its substance is genuinely NOWHERE in the agreement.
Be conservative — it is worse to falsely flag a present clause than to miss a genuinely absent one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPULSORY IGR CLAUSES (check each is present using the guidance above):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{json.dumps(compulsory_names, indent=2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RED FLAG PATTERNS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Flag if any of these appear. Also flag ANY clause that is one-sided, illegal under MRCA 1999,
or grants the licensor unilateral rights that override the licensee's legal protections.

Known patterns:
{json.dumps(red_flag_patterns, indent=2)}

IGR clause reference guide:
- Entry without notice = IGR Clause 4.8
- Cancellation/notice period = IGR Clause 4.9
- Stamp duty entirely on licensee alone = IGR Clause 4.12, severity HIGH
- Stamp duty shared equally between parties = IGR Clause 4.12, severity LOW (common practice)
- Stamp duty on licensor = IGR Clause 4.12, no flag needed
- Maintenance all on tenant = IGR Clause 4.4
- Deposit terms = IGR Clause 4.2
- Self-help eviction (removing tenant without court) = IGR Clause 4.10
- Subletting = IGR Clause 4.7
- Rent increase without notice = IGR Clause 4.2
- Registration = IGR Clause 4.12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT FLAG AS RED FLAGS — THESE ARE NORMAL AND ACCEPTABLE IN MAHARASHTRA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Stamp duty shared equally between licensor and licensee → standard market practice, do NOT flag
- Overstay penalty at double the daily rent → this is the IGR standard, do NOT flag
- Licensor's right to inspect with reasonable notice → standard clause, do NOT flag
- No tenancy rights clause → mandatory in every Leave and License, do NOT flag
- Lock-in penalty if licensee leaves early → standard, do NOT flag
- Licensee paying electricity bills directly → standard, do NOT flag
- Licensee maintaining premises in existing condition → standard, do NOT flag
- No alteration without written consent → standard, do NOT flag

NOTE: The above exceptions apply to STANDARD clauses only. Always flag:
- Termination triggered by licensee losing employment → this is NOT standard, flag as HIGH
- Any clause giving licensor right to terminate outside the agreed notice period → flag as HIGH
- Any clause requiring licensee to prove employment status to continue occupancy → flag as HIGH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCRIMINATORY PATTERNS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Flag if any clause discriminates on religion, caste, marital status, diet, gender,
nationality, family status, occupation class, or any other protected characteristic under
Article 15 of the Indian Constitution. Use severity "CRITICAL" for all discriminatory clauses.

{json.dumps(discriminatory_patterns, indent=2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STANDARD VALUES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Notice period: {standard_values["notice_period_days"]} days (mutual)
- Rent due by: day {standard_values["rent_due_by_day_of_month"]} of month
- Registration: {standard_values["registration"]}
- Stamp duty borne by: {standard_values["stamp_duty_borne_by"]}
- Witnesses required: {standard_values["witnesses_required"]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGREEMENT TEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{clean_text[:10000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — Respond ONLY with this JSON, no markdown, no explanation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{
  "summary": "2-3 sentence plain English summary for a tenant with no legal background",
  "financials": {{
    "monthly_rent": "amount or null",
    "security_deposit": "amount + refundable/non-refundable or null",
    "lock_in_period": "duration or null",
    "notice_period": "duration or null",
    "rent_escalation": "percentage or description or null",
    "stamp_duty_borne_by": "licensor or licensee or equally or null",
    "overstay_penalty": "penalty description or null"
  }},
  "red_flags": [
    {{
      "clause": "exact problematic clause text from the agreement",
      "igr_reference": "specific IGR clause number e.g. IGR Clause 4.10",
      "explanation": "plain English explanation of why this is a problem and what the law says",
      "severity": "HIGH or MEDIUM or LOW"
    }}
  ],
  "discriminatory_clauses": [
    {{
      "clause": "exact discriminatory clause text",
      "explanation": "plain English explanation of why this discriminates and why it is void",
      "legal_basis": "Article 15, Constitution of India",
      "severity": "CRITICAL"
    }}
  ],
    "missing_clauses": [
    {{
      "clause": "name of clause genuinely absent from the agreement",
      "igr_reference": "IGR clause number",
      "why_it_matters": "plain English risk to the tenant"
    }}
  ],
  "action_items": [
    {{
      "action": "specific actionable step the tenant should take",
      "priority": "urgent or high or medium or low"
    }}
  ],
  "overall_score": {{
    "score": 0,
    "verdict": "one sentence plain English verdict — be specific about the Mumbai/Thane market and what the tenant should do"
  }}
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=3000,
        temperature=0.1
    )

    result = json.loads(response.choices[0].message.content)

    # ── Strip false positives ─────────────────────────────────────────
    result["red_flags"] = [
        f for f in result.get("red_flags", [])
        if not is_false_positive(f.get("clause", ""))
    ]

    # ── Deterministic missing clause detection — overrides LLM ───────
    # Hybrid missing clause detection
    ai_missing = result.get("missing_clauses", [])
    result["missing_clauses"] = detect_missing_clauses(clean_text, ai_missing)

    # ── Compulsory financial fields check ─────────────────────────────
    result = check_compulsory_financials(result)

    # ── Deterministic score ───────────────────────────────────────────
    result["overall_score"]["score"] = calculate_score(result, clean_text)

    return result