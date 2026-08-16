// Run: npm install cors
// Then replace your backend/src/index.js with this

const express = require('express')
const cors    = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const analyzeRouter = require('./routes/analyze')

const app  = express()
const PORT = process.env.PORT || 5000

// ── CORS: allow Vite dev server ──────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))

app.use(express.json())

// ── Routes ───────────────────────────────────────────────────
app.use('/api/analyze', analyzeRouter)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// ── MongoDB ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err))

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`)
})