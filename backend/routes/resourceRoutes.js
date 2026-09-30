const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
  allocateResource,
  releaseAllocation,
  approveAllocation,
  getAllocations,
  suggestResources,
} = require('../controllers/resourceController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

// ─── Resource CRUD (admin / department_head) ───────────────────────────────────
router
  .route('/')
  .get(authorize('admin', 'department_head', 'officer'), getResources)
  .post(
    authorize('admin', 'department_head'),
    [
      body('name').trim().notEmpty().withMessage('Resource name is required'),
      body('type')
        .notEmpty()
        .isIn(['human', 'financial', 'equipment', 'material', 'facility', 'technology'])
        .withMessage('Invalid resource type'),
      body('department').notEmpty().withMessage('Department is required'),
    ],
    validate,
    createResource
  );

router
  .route('/:id')
  .get(authorize('admin', 'department_head', 'officer'), getResourceById)
  .patch(authorize('admin', 'department_head'), updateResource)
  .delete(authorize('admin'), deleteResource);

// ─── Allocations ───────────────────────────────────────────────────────────────
router.get(
  '/allocations/list',
  authorize('admin', 'department_head', 'officer'),
  getAllocations
);

router.post(
  '/allocate',
  authorize('admin', 'department_head', 'officer'),
  [
    body('resourceId').notEmpty().withMessage('Resource ID is required'),
    body('grievanceId').notEmpty().withMessage('Grievance ID is required'),
    body('quantityOrAmount').isNumeric({ min: 1 }).withMessage('Valid quantity/amount is required'),
    body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  ],
  validate,
  allocateResource
);

router.patch(
  '/allocations/:id/release',
  authorize('admin', 'department_head', 'officer'),
  releaseAllocation
);

router.patch(
  '/allocations/:id/approve',
  authorize('admin', 'department_head'),
  approveAllocation
);

// ─── AI Suggestions ───────────────────────────────────────────────────────────
router.get(
  '/suggest/:grievanceId',
  authorize('admin', 'department_head', 'officer'),
  suggestResources
);

module.exports = router;
