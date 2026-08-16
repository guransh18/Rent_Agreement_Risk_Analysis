const express  = require('express');
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch');
require('dotenv').config();

const router = express.Router();

// ── Multer: memory storage — no filesystem, no race conditions ─
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are supported.'));
  }
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── POST /api/analyze ─────────────────────────────────────────
router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file received.' });
    }

    console.log(`📄 Received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    // req.file.buffer is the PDF in memory — never touches disk
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename:    req.file.originalname,
      contentType: 'application/pdf'
    });

    console.log(`🔁 Forwarding to AI service at ${AI_SERVICE_URL}/api/analyze`);

    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/analyze`, {
      method:  'POST',
      body:    form,
      headers: form.getHeaders()
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`❌ AI service error ${aiResponse.status}:`, errText);
      return res.status(502).json({
        message: `AI service returned ${aiResponse.status}: ${errText}`
      });
    }

    const result = await aiResponse.json();
    console.log(`✅ Analysis complete. Score: ${result?.overall_score?.score ?? 'N/A'}`);

    return res.json(result);

  } catch (err) {
    console.error('❌ Analyze route error:', err.message);
    return res.status(500).json({ message: err.message });
  }
  // No finally needed — memory is freed automatically, nothing to delete
});

// ── Multer error handler ──────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;