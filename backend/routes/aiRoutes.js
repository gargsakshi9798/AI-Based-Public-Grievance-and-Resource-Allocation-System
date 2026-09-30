const express = require('express');
const router = express.Router();

const {
  classifyGrievanceById,
  routeGrievance,
  findDuplicates,
  getResolutionSuggestion,
  batchClassify,
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Officers, department heads, and admins can trigger AI operations
router.post('/classify/:grievanceId', authorize('admin', 'department_head', 'officer'), classifyGrievanceById);
router.post('/route/:grievanceId', authorize('admin', 'department_head'), routeGrievance);
router.get('/duplicates/:grievanceId', authorize('admin', 'department_head', 'officer'), findDuplicates);
router.get('/resolve-suggestion/:grievanceId', authorize('admin', 'department_head', 'officer'), getResolutionSuggestion);
router.post('/batch-classify', authorize('admin'), batchClassify);

module.exports = router;
