import { useState } from 'react'

const SEV_CONFIG = {
  critical: { label: 'CRITICAL', cls: 'sev-critical' },
  high:     { label: 'HIGH',     cls: 'sev-high'     },
  medium:   { label: 'MEDIUM',   cls: 'sev-medium'   },
  low:      { label: 'LOW',      cls: 'sev-low'      }
}

const PRI_CONFIG = {
  urgent: { label: 'URGENT', cls: 'pri-urgent' },
  high:   { label: 'HIGH',   cls: 'pri-high'   },
  medium: { label: 'MEDIUM', cls: 'pri-medium' },
  low:    { label: 'LOW',    cls: 'pri-low'    }
}

const FIN_LABELS = {
  monthly_rent:        'Monthly Rent',
  security_deposit:    'Security Deposit',
  lock_in_period:      'Lock-in Period',
  notice_period:       'Notice Period',
  rent_escalation:     'Rent Escalation',
  stamp_duty_borne_by: 'Stamp Duty By',
  overstay_penalty:    'Overstay Penalty'
}

const isNull = (val) =>
  !val || ['null', 'n/a', 'none', 'not mentioned', 'not specified', 'not stated'].includes(
    String(val).toLowerCase().trim()
  )

const displayVal = (val) => isNull(val) ? '⚠ Not in document' : val

export default function Dashboard({ data }) {
  const {
    summary               = '',
    financials            = {},
    red_flags             = [],
    discriminatory_clauses = [],
    missing_clauses       = [],
    action_items          = [],
    overall_score         = {}
  } = data

  const validFinancials = Object.entries(financials)

  return (
    <div className="dashboard">

      {/* ── Score + Summary ── */}
      <div className="dash-top">
        <ScoreCard score={overall_score} />
        <SummaryCard
          summary={summary}
          redCount={red_flags.length}
          discrimCount={discriminatory_clauses.length}
          missingCount={missing_clauses.length}
          actionCount={action_items.length}
        />
      </div>

      {/* ── Discriminatory Clauses ── */}
      {discriminatory_clauses.length > 0 && (
        <section className="dash-section">
          <div className="section-header critical-header">
            <span className="section-icon">🚨</span>
            <h2 className="section-title">
              Discriminatory Clauses
              <span className="section-count">{discriminatory_clauses.length}</span>
            </h2>
          </div>
          <div className="section-body">
            {discriminatory_clauses.map((c, i) => (
              <div key={i} className="discrim-card">
                <div className="discrim-top">
                  <SevBadge sev={c.severity} />
                  <span className="legal-basis-tag">{c.legal_basis}</span>
                </div>
                <blockquote className="clause-quote">"{c.clause}"</blockquote>
                <p className="clause-explanation">{c.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Financials ── */}
      {validFinancials.length > 0 && (
        <section className="dash-section">
          <div className="section-header">
            <span className="section-icon">💰</span>
            <h2 className="section-title">Financial Terms</h2>
          </div>
          <div className="section-body">
            <div className="financials-grid">
              {validFinancials.map(([key, val]) => (
                <div key={key} className="fin-cell">
                  <span className="fin-label">{FIN_LABELS[key] || formatKey(key)}</span>
                  <span className={`fin-value ${isNull(val) ? 'fin-missing' : ''}`}>
                    {displayVal(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Red Flags ── */}
      {red_flags.length > 0 && (
        <section className="dash-section">
          <div className="section-header">
            <span className="section-icon">🚩</span>
            <h2 className="section-title">
              Red Flags
              <span className="section-count">{red_flags.length}</span>
            </h2>
          </div>
          <div className="section-body">
            {red_flags.map((f, i) => <RedFlagCard key={i} flag={f} />)}
          </div>
        </section>
      )}

      {/* ── Missing Clauses ── */}
      {missing_clauses.length > 0 && (
        <section className="dash-section">
          <div className="section-header">
            <span className="section-icon">📋</span>
            <h2 className="section-title">
              Missing IGR Clauses
              <span className="section-count">{missing_clauses.length}</span>
            </h2>
          </div>
          <div className="section-body">
            {missing_clauses.map((c, i) => (
              <div key={i} className="missing-card">
                <div className="missing-top">
                  <span className="missing-title">{c.clause}</span>
                  <span className="igr-tag">{c.igr_reference}</span>
                </div>
                <p className="missing-why">{c.why_it_matters}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Action Plan ── */}
      {action_items.length > 0 && (
        <section className="dash-section">
          <div className="section-header">
            <span className="section-icon">✅</span>
            <h2 className="section-title">
              Action Plan
              <span className="section-count">{action_items.length}</span>
            </h2>
          </div>
          <div className="section-body">
            <div className="actions-list">
              {action_items.map((a, i) => (
                <div key={i} className="action-row">
                  <PriBadge pri={a.priority} />
                  <p className="action-text">{a.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}

/* ─── Sub-components ─── */

function ScoreCard({ score }) {
  const s       = parseFloat(score.score) || 0
  const verdict = score.verdict || ''
  const color   = s >= 7 ? '#10B981' : s >= 5 ? '#EAB308' : '#EF4444'
  const r       = 58
  const circ    = 2 * Math.PI * r
  const dash    = (s / 10) * circ

  return (
    <div className="score-card">
      <svg width="150" height="150" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1E2A45" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="80" y="76" textAnchor="middle" fill={color} fontSize="34" fontWeight="700"
          fontFamily="Plus Jakarta Sans, sans-serif">{s}</text>
        <text x="80" y="98" textAnchor="middle" fill="#4A5568" fontSize="11"
          fontFamily="Plus Jakarta Sans, sans-serif">out of 10</text>
      </svg>
      <div className="score-verdict" style={{ color }}>{verdict}</div>
      <div className="score-sublabel">IGR Compliance Score</div>
    </div>
  )
}

function SummaryCard({ summary, redCount, discrimCount, missingCount, actionCount }) {
  return (
    <div className="summary-card">
      <div className="summary-stats">
        <StatChip n={redCount}     label="Red Flags"      color="#EF4444" />
        <StatChip n={discrimCount} label="Discriminatory"  color="#A855F7" />
        <StatChip n={missingCount} label="Missing"         color="#F59E0B" />
        <StatChip n={actionCount}  label="Actions"         color="#3B82F6" />
      </div>
      {summary && <p className="summary-text">{summary}</p>}
    </div>
  )
}

function StatChip({ n, label, color }) {
  return (
    <div className="stat-chip" style={{ '--chip-color': color }}>
      <span className="stat-n">{n}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function RedFlagCard({ flag }) {
  return (
    <div className={`flag-card flag-${flag.severity?.toLowerCase()}`}>
      <div className="flag-header-static">
        <div className="flag-badges">
          <SevBadge sev={flag.severity?.toLowerCase()} />
          <span className="igr-tag">{flag.igr_reference}</span>
        </div>
        <p className="clause-quote-sm">"{flag.clause}"</p>
      </div>
      <p className="flag-explanation">{flag.explanation}</p>
    </div>
  )
}

function SevBadge({ sev }) {
  const key = sev?.toLowerCase()
  const cfg = SEV_CONFIG[key] || { label: sev?.toUpperCase(), cls: 'sev-low' }
  return <span className={`sev-badge ${cfg.cls}`}>{cfg.label}</span>
}

function PriBadge({ pri }) {
  const key = pri?.toLowerCase()
  const cfg = PRI_CONFIG[key] || { label: pri?.toUpperCase(), cls: 'pri-medium' }
  return <span className={`pri-badge ${cfg.cls}`}>{cfg.label}</span>
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
