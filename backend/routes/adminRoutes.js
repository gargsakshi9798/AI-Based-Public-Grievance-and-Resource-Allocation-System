const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getDashboardStats,
  getGrievanceAnalytics,
  getDepartmentPerformance,
  getResourceAnalytics,
  getUserAnalytics,
  getSLABreaches,
  getUnassignedGrievances,
  bulkAssignGrievances,
  getAuditLog,
  broadcastNotification,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All admin routes require authentication + admin role
router.use(protect, authorize('admin'));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', getDashboardStats);

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/grievances', getGrievanceAnalytics);
router.get('/analytics/departments', getDepartmentPerformance);
router.get('/analytics/resources', getResourceAnalytics);
router.get('/analytics/users', getUserAnalytics);

// ─── Grievance Management ─────────────────────────────────────────────────────
router.get('/grievances/sla-breaches', getSLABreaches);
router.get('/grievances/unassigned', getUnassignedGrievances);
router.post(
  '/grievances/bulk-assign',
  [
    body('grievanceIds')
      .isArray({ min: 1 })
      .withMessage('grievanceIds must be a non-empty array'),
  ],
  validate,
  bulkAssignGrievances
);

// ─── Audit Log ────────────────────────────────────────────────────────────────
router.get('/audit-log', getAuditLog);

// ─── Notifications ────────────────────────────────────────────────────────────
router.post(
  '/notifications/broadcast',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('targetRole')
      .optional()
      .isIn(['citizen', 'officer', 'admin', 'department_head'])
      .withMessage('Invalid target role'),
  ],
  validate,
  broadcastNotification
);

module.exports = router;
