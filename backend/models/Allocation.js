const mongoose = require('mongoose');

// Standalone allocation record for full audit trail
const allocationSchema = new mongoose.Schema(
  {
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
    },
    grievance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    quantityOrAmount: {
      type: Number,
      required: [true, 'Quantity or amount is required'],
      min: [0, 'Value cannot be negative'],
    },

    unit: { type: String, default: 'units' }, // e.g. INR, liters, persons

    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'active', 'completed', 'cancelled'],
      default: 'pending_approval',
    },

    // AI-suggested allocation
    isAiSuggested: { type: Boolean, default: false },
    aiConfidenceScore: { type: Number, min: 0, max: 1 },
    aiRationale: { type: String, maxlength: 1000 },

    startDate: { type: Date, default: Date.now },
    endDate: Date,
    completedAt: Date,

    notes: { type: String, maxlength: 1000 },

    utilizationReport: {
      actualQuantityUsed: Number,
      outcome: String,
      submittedAt: Date,
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

allocationSchema.index({ resource: 1 });
allocationSchema.index({ grievance: 1 });
allocationSchema.index({ department: 1 });
allocationSchema.index({ status: 1 });
allocationSchema.index({ allocatedBy: 1 });

module.exports = mongoose.model('Allocation', allocationSchema);
