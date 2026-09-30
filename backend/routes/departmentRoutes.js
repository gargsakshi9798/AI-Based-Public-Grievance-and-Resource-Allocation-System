const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignHead,
  getDepartmentOfficers,
  getDepartmentGrievances,
  getDepartmentStats,
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

// ─── Public read (all authenticated users can list departments) ────────────────
router.get('/', getDepartments);
router.get('/:id', getDepartmentById);

// ─── Department-specific sub-resources ────────────────────────────────────────
router.get(
  '/:id/officers',
  authorize('admin', 'department_head'),
  getDepartmentOfficers
);

router.get(
  '/:id/grievances',
  authorize('admin', 'department_head', 'officer'),
  getDepartmentGrievances
);

router.get(
  '/:id/stats',
  authorize('admin', 'department_head'),
  getDepartmentStats
);

// ─── Admin-only write operations ───────────────────────────────────────────────
router.post(
  '/',
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Department code is required')
      .matches(/^[A-Z0-9_]{2,10}$/)
      .withMessage('Code must be 2–10 uppercase letters/numbers'),
    body('handledCategories')
      .optional()
      .isArray()
      .withMessage('handledCategories must be an array'),
  ],
  validate,
  createDepartment
);

router.patch(
  '/:id',
  authorize('admin'),
  updateDepartment
);

router.delete(
  '/:id',
  authorize('admin'),
  deleteDepartment
);

router.patch(
  '/:id/assign-head',
  authorize('admin'),
  [body('userId').notEmpty().withMessage('User ID is required')],
  validate,
  assignHead
);

module.exports = router;
