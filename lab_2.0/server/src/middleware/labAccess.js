const mongoose = require('mongoose');
const { Laboratory, LabAccessGrant, AuditEvent } = require('../models');
const { requireAuth, requireRole } = require('./requireAuth');

async function loadOwnedLaboratory(req, res, next) {
  try {
    const laboratory = await Laboratory.findOne({
      user_id: req.auth.sub,
      platform_approval_status: { $ne: 'REVOKED' },
    });

    if (!laboratory) {
      return res.status(403).json({
        success: false,
        error: 'LABORATORY_PROFILE_REQUIRED',
      });
    }

    req.laboratory = laboratory;
    return next();
  } catch (error) {
    return next(error);
  }
}

const requireLabOperator = [requireAuth, requireRole('LABORATORY'), loadOwnedLaboratory];

async function enforceActiveLabGrant(req, res, next) {
  try {
    const grantId = req.params.grantId || req.body?.grant_id || req.query.grant_id;
    if (!grantId || !mongoose.isValidObjectId(grantId)) {
      return res.status(400).json({
        success: false,
        error: 'VALID_GRANT_ID_REQUIRED',
      });
    }

    const grant = await LabAccessGrant.findOne({ _id: grantId, laboratory_id: req.laboratory._id })
      .populate('patient_id')
      .populate({ path: 'diagnostic_order_id', populate: { path: 'doctor_id' } });

    if (!grant) {
      return res.status(404).json({ success: false, error: 'LAB_ACCESS_GRANT_NOT_FOUND' });
    }

    if (grant.status !== 'ACTIVE' || grant.published_report_id) {
      await AuditEvent.create({
        actor_type: 'LABORATORY',
        actor_id: req.laboratory._id.toString(),
        action: 'ACCESS_ATTEMPT_DENIED',
        resource_type: 'LabAccessGrant',
        resource_id: grant._id.toString(),
        patient_id: grant.patient_id?._id || grant.patient_id,
        outcome: 'EXPIRED',
        details: {
          reason: 'Laboratory access ends when the associated report is published.',
        },
      });

      return res.status(403).json({
        success: false,
        error: 'BOUNDED_ACCESS_EXPIRED',
        grant_status: grant.status,
      });
    }

    if (!grant.patient_id) {
      return res.status(404).json({ success: false, error: 'PATIENT_NOT_FOUND' });
    }

    req.labGrant = grant;
    return next();
  } catch (error) {
    console.error('Laboratory grant access error:', error);
    return res.status(500).json({ success: false, error: 'LAB_ACCESS_CHECK_FAILED' });
  }
}

module.exports = { requireLabOperator, enforceActiveLabGrant, loadOwnedLaboratory };
