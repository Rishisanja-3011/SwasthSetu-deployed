const express = require('express');

const router = express.Router();

// Canonical collections are initialized through scripts/initDatabase.js.
// The legacy HTTP reset deleted unrelated users and records.
router.use((req, res) => res.status(410).json({
  success: false,
  error: 'DEMO_SEED_DISABLED',
  message: 'Use platform onboarding and authenticated patient visits.',
}));

module.exports = router;
