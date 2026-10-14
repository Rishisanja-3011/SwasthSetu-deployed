const express = require('express');

const { publicProvider, resolveProvider } = require('../services/providerService');

const router = express.Router();

// Public provider metadata is safe to resolve before authentication. It never
// returns a patient, report, note, or history record.
router.get('/resolve/:providerCode', async (req, res) => {
  try {
    const provider = await resolveProvider(req.params.providerCode);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'PROVIDER_NOT_FOUND',
        message: 'Unknown or inactive doctor/laboratory code.',
      });
    }
    return res.json({ success: true, provider: publicProvider(provider) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'PROVIDER_LOOKUP_FAILED' });
  }
});

module.exports = router;
