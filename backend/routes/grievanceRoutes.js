const express = require('express');
const { body, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

const {
  createGrievance,
  getGrievances,
  getGrievanceById,
  trackGrievance,
  updateGrievance,
  deleteGrievance,
  addComment,
  toggleUpvote,
  submitFeedback,
  escalateGrievance,
} = require('../controllers/grievanceController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ─── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/grievances'),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mov/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only images, PDFs, documents, and videos are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter,
});

// ─── Public (no auth) ──────────────────────────────────────────────────────────
router.get('/track/:trackingId', trackGrievance);

// ─── Protected ────────────────────────────────────────────────────────────────
router.use(protect);

router
  .route('/')
  .get(getGrievances)
  .post(
    upload.array('attachments', 5),
    [
      body('title').trim().notEmpty().withMessage('Title is required')
        .isLength({ min: 10, max: 200 }).withMessage('Title must be 10–200 characters'),
      body('description').trim().notEmpty().withMessage('Description is required')
        .isLength({ min: 20, max: 5000 }).withMessage('Description must be 20–5000 characters'),
      body('category').notEmpty().withMessage('Category is required')
        .isIn(['infrastructure','sanitation','water_supply','electricity','healthcare',
          'education','public_safety','transportation','environment','social_welfare','corruption','other'])
        .withMessage('Invalid category'),
    ],
    validate,
    createGrievance
  );

router
  .route('/:id')
  .get(getGrievanceById)
  .patch(updateGrievance)
  .delete(deleteGrievance);

router.post('/:id/comments', [
  body('text').trim().notEmpty().withMessage('Comment text is required')
    .isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters'),
], validate, addComment);

router.post('/:id/upvote', toggleUpvote);

router.post('/:id/feedback', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional().isLength({ max: 1000 }),
], validate, submitFeedback);

router.post(
  '/:id/escalate',
  authorize('admin', 'department_head', 'officer'),
  escalateGrievance
);

module.exports = router;
