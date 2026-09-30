const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        'grievance_submitted',
        'grievance_status_update',
        'grievance_assigned',
        'grievance_resolved',
        'grievance_escalated',
        'comment_added',
        'resource_allocated',
        'resource_approved',
        'system_alert',
        'account_activity',
      ],
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Optional deep-link reference
    reference: {
      model: { type: String, enum: ['Grievance', 'Resource', 'Allocation', 'Department', 'User'] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },

    isRead: { type: Boolean, default: false },
    readAt: Date,

    // Channel tracking
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      emailSentAt: Date,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
