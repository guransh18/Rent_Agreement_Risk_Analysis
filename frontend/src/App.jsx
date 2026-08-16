import { useState, useRef } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'

const DEMO_DATA = {
  summary:
    "This Maharashtra Leave & License Agreement for a residential flat in Thane (Doc No. 16155/2025) has been analyzed against the IGR Gold Standard and MRCA 1999. The agreement contains 3 red flags, 1 critical discriminatory clause, and is missing 3 IGR-mandated provisions. Several clauses are either unenforceable or unconstitutional. Do not sign without the amendments outlined in the action plan below.",
  financials: {
    monthly_rent: "₹18,000",
    security_deposit: "₹1,08,000 (6 months)",
    lock_in_period: "11 months",
    notice_period: "1 month",
    rent_escalation: "10% per annum",
    stamp_duty_borne_by: "Licensee",
    overstay_penalty: "₹2,000/day"
  },
  red_flags: [
    {
      clause: "Security deposit shall not be refunded if licensee vacates before the lock-in period expires.",
      igr_reference: "IGR Clause 4.2",
      explanation:
        "Security deposit forfeiture is unenforceable under MRCA 1999, Section 14. The licensor must refund the full deposit within 30 days of vacation regardless of when the licensee leaves.",
      severity: "high"
    },
    {
      clause: "Licensor may enter and inspect the premises at any time without prior notice.",
      igr_reference: "IGR Clause 7.1",
      explanation:
        "Right to peaceful enjoyment is implied in every Leave & License agreement. Entry without notice violates this right. Maharashtra courts have consistently required a minimum 24-hour written notice for non-emergency inspections.",
      severity: "medium"
    },
    {
      clause: "All disputes arising from this agreement shall be resolved at the sole discretion of the Licensor.",
      igr_reference: "IGR Clause 12.3",
      explanation:
        "Clauses that vest unilateral dispute resolution power in one party are void ab initio. All disputes must follow MRCA 1999 procedure before the Rent Authority.",
      severity: "high"
    }
  ],
  discriminatory_clauses: [
    {
      clause: "The premises shall not be occupied, used, or enjoyed by persons of any religion other than Hindu.",
      explanation:
        "This clause facially violates Article 15(1) of the Constitution of India, which prohibits discrimination on grounds of religion. The clause is void and unenforceable. The tenant may also file a complaint under applicable anti-discrimination provisions.",
      legal_basis: "Article 15(1), Constitution of India",
      severity: "critical"
    }
  ],
  missing_clauses: [
    {
      clause: "Maintenance Responsibility Schedule",
      igr_reference: "IGR Clause 9",
      why_it_matters:
        "Without an explicit schedule, disputes over plumbing, electrical, and structural repairs are extremely common. The IGR template mandates clear allocation of all repair categories between licensor and licensee."
    },
    {
      clause: "Sub-Letting Prohibition",
      igr_reference: "IGR Clause 11",
      why_it_matters:
        "The IGR template mandates an explicit sub-letting prohibition. Its absence creates ambiguity about whether the licensee can sub-let the premises to third parties."
    },
    {
      clause: "Inventory & Fixtures List (Annexure)",
      igr_reference: "IGR Clause 5.4",
      why_it_matters:
        "Without an attached inventory baseline, security deposit deductions for damage cannot be fairly adjudicated. This is the most common source of end-of-tenancy disputes."
    }
  ],
  action_items: [
    {
      action:
        "Demand immediate removal of the religion restriction clause — it is unconstitutional. If the licensor refuses, do not sign and report to the Maharashtra Rent Authority.",
      priority: "urgent"
    },
    {
      action:
        "Delete or amend the security deposit forfeiture clause to comply with MRCA 1999: full refund within 30 days of vacation, no conditions.",
      priority: "urgent"
    },
    {
      action:
        "Amend the entry clause to specify a minimum 24-hour written notice requirement before any licensor inspection.",
      priority: "high"
    },
    {
      action:
        "Replace the unilateral dispute resolution clause with a reference to the Maharashtra Rent Authority under MRCA 1999.",
      priority: "high"
    },
    {
      action:
        "Request a Maintenance Schedule as Annexure A before signing, allocating repair responsibility by category.",
      priority: "medium"
    },
    {
      action:
        "Attach a signed Inventory List as Annexure B covering all fixtures, appliances, and fittings in the premises.",
      priority: "medium"
    }
  ],
  overall_score: {
    score: 4.5,
    verdict: "Do Not Sign As-Is"
  }
}

const LOAD_STEPS = [
  "Extracting text from PDF…",
  "Running OCR on scanned pages…",
  "Stripping PII with Presidio…",
  "Analyzing against IGR Gold Standard…",
  "Detecting red flags and omissions…",
  "Scoring agreement…"
]

export default function App() {
  const [appState, setAppState] = useState('idle') // idle | loading | result | error
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const fileRef = useRef(null)

  const runAnalysis = async (file) => {
    setFileName(file.name)
    setAppState('loading')
    setLoadStep(0)

    const stepInterval = setInterval(() => {
      setLoadStep((prev) => Math.min(prev + 1, LOAD_STEPS.length - 1))
    }, 4500)

    const formData = new FormData()
    formData.append('pdf', file)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      })

      clearInterval(stepInterval)

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      setResult(data)
      setAppState('result')
    } catch (e) {
      clearInterval(stepInterval)
      console.error('[RentGuard] Analysis failed:', e)
      setError(e.message || 'Unknown error — check the browser console (F12).')
      setAppState('error')
    }
  }

  const onFileSelect = (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported. Please upload a valid PDF.')
      setAppState('error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.')
      setAppState('error')
      return
    }
    runAnalysis(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    onFileSelect(e.dataTransfer.files[0])
  }

  const reset = () => {
    setAppState('idle')
    setResult(null)
    setFileName('')
    setError('')
    setLoadStep(0)
  }

  return (
    <div className="app">
      <Header showBack={appState === 'result'} onBack={reset} />
      <main className="main">
        {appState === 'idle' && (
          <UploadView
            dragging={dragging}
            setDragging={setDragging}
            handleDrop={handleDrop}
            onFileSelect={onFileSelect}
            fileRef={fileRef}
            onDemo={() => { setResult(DEMO_DATA); setAppState('result') }}
          />
        )}
        {appState === 'loading' && (
          <LoadingView steps={LOAD_STEPS} currentStep={loadStep} fileName={fileName} />
        )}
        {appState === 'result' && result && (
          <Dashboard data={result} />
        )}
        {appState === 'error' && (
          <ErrorView error={error} onReset={reset} />
        )}
      </main>
    </div>
  )
}

function Header({ showBack, onBack }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon">⚖️</div>
          <div>
            <div className="logo-name">RentGuard</div>
            <div className="logo-sub">Maharashtra Residential Rent Agreement Analyzer</div>
          </div>
        </div>
        <div className="header-right">
          <span className="header-badge">IGR Grounded</span>
          <span className="header-badge">MRCA 1999</span>
          <span className="header-badge">Zero Retention</span>
            <a href="https://igrmaharashtra.gov.in/pdf/documents/7_Agrrement_of_Leave_and_Lic.doc"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-igr-download">  
            Download Official IGR Template
            </a>
          {showBack && (
            <button className="btn-ghost" onClick={onBack}>
              ← New Analysis
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function UploadView({ dragging, setDragging, handleDrop, onFileSelect, fileRef, onDemo }) {
  return (
    <div className="upload-view">
      <div className="hero">
        <div className="hero-eyebrow">IGR Gold Standard · Presidio PII Stripping</div>
        <h1 className="hero-title">Know What You're Signing</h1>
        <p className="hero-sub">
          Upload any Maharashtra Leave & License Agreement. Every clause is analyzed against the official IGR template
          and flagged for what's illegal, unfair, or missing - in plain English.
        </p>
      </div>

      <div
        className={`dropzone${dragging ? ' dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="Upload PDF agreement"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => onFileSelect(e.target.files[0])}
        />
        <div className="dz-icon">📄</div>
        <p className="dz-title">{dragging ? 'Release to analyze' : 'Drop your agreement here'}</p>
        <p className="dz-hint">or click to browse · PDF only · max 10MB</p>
      </div>

      <div className="features-grid">
        {[
          { icon: '🔍', title: 'IGR Clause Mapping', desc: 'Every finding linked to official IGR clause reference' },
          { icon: '🛡️', title: 'Zero Data Retention', desc: 'PII (Personally Identifiable Information) stripped locally, PDF deleted after extraction' },
          { icon: '⚖️', title: 'Legal Grounding', desc: 'MRCA 1999 and Article 15 discrimination checks' },
          { icon: '📊', title: 'Rubric-Based Scoring', desc: 'Deterministic score, not an LLM guess' }
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <strong className="feature-title">{f.title}</strong>
            <span className="feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>

      <div className="demo-bar">
        <span>No PDF on hand?</span>
        <button className="btn-demo" onClick={onDemo}>Load sample analysis →</button>
      </div>
    </div>
  )
}

function LoadingView({ steps, currentStep, fileName }) {
  return (
    <div className="loading-view">
      <div className="spinner-ring" />
      <h2 className="loading-title">Analyzing Agreement</h2>
      <p className="loading-file">{fileName}</p>
      <p className="loading-step">{steps[currentStep]}</p>
      <div className="step-dots">
        {steps.map((_, i) => (
          <div key={i} className={`step-dot${i <= currentStep ? ' active' : ''}`} />
        ))}
      </div>
      <p className="loading-note">This typically takes 15–30 seconds</p>
    </div>
  )
}

function ErrorView({ error, onReset }) {
  return (
    <div className="error-view">
      <div className="error-icon">⚠️</div>
      <h2>Analysis Failed</h2>
      <p className="error-msg">{error}</p>
      <p className="error-hint">
        Make sure both servers are running:<br />
        Backend on <code>port 5000</code> · AI Service on <code>port 8000</code>
      </p>
      <button className="btn-primary" onClick={onReset}>Try Again</button>
    </div>
  )
}
