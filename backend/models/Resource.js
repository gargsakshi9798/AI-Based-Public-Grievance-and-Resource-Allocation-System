const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Resource name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },

    type: {
      type: String,
      required: [true, 'Resource type is required'],
      enum: [
        'human',        // staff / officers
        'financial',    // budget allocation
        'equipment',    // vehicles, machinery, tools
        'material',     // construction supplies, medicines, etc.
        'facility',     // buildings, offices, labs
        'technology',   // software licenses, devices
      ],
    },

    description: {
      type: String,
      maxlength: 1000,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },

    // For financial resources
    budget: {
      total: { type: Number, default: 0 },
      allocated: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },

    // For physical / human resources
    quantity: {
      total: { type: Number, default: 1 },
      available: { type: Number, default: 1 },
      allocated: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ['available', 'partially_allocated', 'fully_allocated', 'under_maintenance', 'retired'],
      default: 'available',
    },

    // Allocations history
    allocations: [
      {
        grievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance' },
        allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        quantityOrAmount: { type: Number, required: true },
        purpose: { type: String, maxlength: 500 },
        allocatedAt: { type: Date, default: Date.now },
        releasedAt: Date,
        isActive: { type: Boolean, default: true },
      },
    ],

    // AI-suggested allocation fields
    aiRecommended: { type: Boolean, default: false },
    aiAllocationScore: { type: Number, min: 0, max: 1 },
    aiRecommendationNote: String,

    location: {
      address: String,
      city: String,
      state: String,
    },

    tags: [{ type: String, trim: true }],

    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    lastAuditDate: Date,
    nextAuditDate: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
resourceSchema.index({ department: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ status: 1 });

// ─── Virtual: remaining budget ────────────────────────────────────────────────
resourceSchema.virtual('budget.remaining').get(function () {
  return this.budget.total - this.budget.allocated;
});

// ─── Auto-update status based on quantity ────────────────────────────────────
resourceSchema.pre('save', function (next) {
  if (this.type !== 'financial') {
    const { total, allocated } = this.quantity;
    if (allocated === 0) this.status = 'available';
    else if (allocated < total) this.status = 'partially_allocated';
    else this.status = 'fully_allocated';
    this.quantity.available = total - allocated;
  }
  next();
});

module.exports = mongoose.model('Resource', resourceSchema);
