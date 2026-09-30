const mongoose = require('mongoose');

// ─── Sub-schemas ───────────────────────────────────────────────────────────────
const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
    isInternal: { type: Boolean, default: false }, // internal officer notes vs public
  },
  { timestamps: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadedAt: { type: Date, default: Date.now },
});

// ─── Main Grievance Schema ─────────────────────────────────────────────────────
const grievanceSchema = new mongoose.Schema(
  {
    // Auto-generated unique tracking ID, e.g. GRV-2024-00001
    trackingId: {
      type: String,
      unique: true,
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [10, 'Title must be at least 10 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'infrastructure',
        'sanitation',
        'water_supply',
        'electricity',
        'healthcare',
        'education',
        'public_safety',
        'transportation',
        'environment',
        'social_welfare',
        'corruption',
        'other',
      ],
    },

    subCategory: { type: String, trim: true },

    status: {
      type: String,
      enum: ['pending', 'under_review', 'in_progress', 'resolved', 'closed', 'rejected'],
      default: 'pending',
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    // AI-generated fields
    aiCategory: { type: String },
    aiPriority: { type: String },
    aiSentimentScore: { type: Number, min: -1, max: 1 },
    aiSummary: { type: String, maxlength: 500 },
    aiProcessed: { type: Boolean, default: false },

    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Citizen reference is required'],
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },

    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
      },
    },

    attachments: [attachmentSchema],
    comments: [commentSchema],
    statusHistory: [statusHistorySchema],

    // Deadlines
    expectedResolutionDate: Date,
    resolvedAt: Date,
    closedAt: Date,

    // Feedback after resolution
    citizenRating: { type: Number, min: 1, max: 5 },
    citizenFeedback: { type: String, maxlength: 1000 },

    isAnonymous: { type: Boolean, default: false },
    isEscalated: { type: Boolean, default: false },
    escalatedAt: Date,
    escalationReason: String,

    viewCount: { type: Number, default: 0 },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// trackingId unique index is already created by `unique: true` in the field definition.
grievanceSchema.index({ citizen: 1 });
grievanceSchema.index({ department: 1 });
grievanceSchema.index({ assignedTo: 1 });
grievanceSchema.index({ status: 1 });
grievanceSchema.index({ priority: 1 });
grievanceSchema.index({ category: 1 });
grievanceSchema.index({ createdAt: -1 });
grievanceSchema.index({ 'location.coordinates': '2dsphere' });

// ─── Virtuals ──────────────────────────────────────────────────────────────────
grievanceSchema.virtual('upvoteCount').get(function () {
  return this.upvotes ? this.upvotes.length : 0;
});

grievanceSchema.virtual('daysOpen').get(function () {
  const end = this.resolvedAt || new Date();
  return Math.floor((end - this.createdAt) / (1000 * 60 * 60 * 24));
});

// ─── Auto-generate tracking ID ────────────────────────────────────────────────
grievanceSchema.pre('save', async function (next) {
  if (!this.trackingId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Grievance').countDocuments();
    this.trackingId = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// ─── Push status change into history automatically ────────────────────────────
grievanceSchema.pre('save', function (next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({ status: this.status });
  }
  next();
});

module.exports = mongoose.model('Grievance', grievanceSchema);
