const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      unique: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },

    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_]{2,10}$/, 'Code must be 2–10 uppercase letters/numbers'],
    },

    description: {
      type: String,
      maxlength: 1000,
    },

    // Which grievance categories this department handles
    handledCategories: [
      {
        type: String,
        enum: [
          'infrastructure', 'sanitation', 'water_supply', 'electricity',
          'healthcare', 'education', 'public_safety', 'transportation',
          'environment', 'social_welfare', 'corruption', 'other',
        ],
      },
    ],

    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    contactPhone: {
      type: String,
      trim: true,
    },

    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // SLA in hours for each priority level
    sla: {
      low: { type: Number, default: 168 },       // 7 days
      medium: { type: Number, default: 72 },      // 3 days
      high: { type: Number, default: 24 },        // 1 day
      critical: { type: Number, default: 6 },     // 6 hours
    },

    // Stats — updated by aggregation jobs
    stats: {
      totalGrievances: { type: Number, default: 0 },
      openGrievances: { type: Number, default: 0 },
      resolvedGrievances: { type: Number, default: 0 },
      avgResolutionTimeHours: { type: Number, default: 0 },
      satisfactionScore: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// name and code unique indexes are already created by `unique: true` in the field definitions.
departmentSchema.index({ handledCategories: 1 });
departmentSchema.index({ isActive: 1 });

// ─── Virtual: resolution rate ──────────────────────────────────────────────────
departmentSchema.virtual('resolutionRate').get(function () {
  const { totalGrievances, resolvedGrievances } = this.stats;
  if (!totalGrievances) return 0;
  return parseFloat(((resolvedGrievances / totalGrievances) * 100).toFixed(2));
});

module.exports = mongoose.model('Department', departmentSchema);
