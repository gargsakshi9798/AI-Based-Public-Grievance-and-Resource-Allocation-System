const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const logger = require('../config/logger');

// ─── Email Transporter (lazy init) ───────────────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

// ─── sendEmail ─────────────────────────────────────────────────────────────────
/**
 * Sends an email via nodemailer.
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email credentials not configured – skipping email send');
    return;
  }

  const mailOptions = {
    from: `"Grievance Portal" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info(`Email sent to ${to}: messageId=${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email send failed to ${to}: ${err.message}`);
    throw err;
  }
};

// ─── createInAppNotification ───────────────────────────────────────────────────
/**
 * Persists an in-app notification to the database.
 */
const createInAppNotification = async ({
  recipientId,
  type,
  title,
  message,
  referenceModel,
  referenceId,
  sendEmailAlso = false,
  emailTo = null,
  emailSubject = null,
  emailHtml = null,
}) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      reference: referenceModel && referenceId
        ? { model: referenceModel, id: referenceId }
        : undefined,
      channels: {
        inApp: true,
        email: sendEmailAlso,
      },
    });

    if (sendEmailAlso && emailTo && emailSubject && emailHtml) {
      sendEmail({ to: emailTo, subject: emailSubject, html: emailHtml })
        .then(() => {
          Notification.findByIdAndUpdate(notification._id, {
            'channels.emailSentAt': new Date(),
          }).exec();
        })
        .catch((err) => logger.error(`Async email failed: ${err.message}`));
    }

    return notification;
  } catch (err) {
    logger.error(`Failed to create in-app notification: ${err.message}`);
    throw err;
  }
};

// ─── sendGrievanceNotification ────────────────────────────────────────────────
/**
 * Dispatches contextual notifications for grievance lifecycle events.
 *
 * @param {'submitted'|'status_update'|'assigned'|'resolved'|'escalated'|'comment'} event
 * @param {Object} grievance  Mongoose grievance document
 * @param {Object} actor      The user who triggered the event
 */
const sendGrievanceNotification = async (event, grievance, actor) => {
  const citizenId = grievance.citizen?._id || grievance.citizen;

  const eventMap = {
    submitted: {
      type: 'grievance_submitted',
      title: 'Grievance Submitted Successfully',
      message: `Your grievance "${grievance.title}" has been submitted with tracking ID ${grievance.trackingId}. We will review it shortly.`,
      emailSubject: `Grievance Received – ${grievance.trackingId}`,
      emailHtml: `<h2>Grievance Submitted</h2>
        <p>Your grievance has been received.</p>
        <p><strong>Tracking ID:</strong> ${grievance.trackingId}</p>
        <p><strong>Title:</strong> ${grievance.title}</p>
        <p><strong>Status:</strong> Pending Review</p>
        <p>You can track your grievance at: <a href="${process.env.CLIENT_URL}/track/${grievance.trackingId}">${process.env.CLIENT_URL}/track/${grievance.trackingId}</a></p>`,
    },
    status_update: {
      type: 'grievance_status_update',
      title: 'Grievance Status Updated',
      message: `Your grievance ${grievance.trackingId} status has been updated to "${grievance.status.replace(/_/g, ' ')}"`,
      emailSubject: `Status Update – ${grievance.trackingId}`,
      emailHtml: `<h2>Grievance Status Update</h2>
        <p><strong>Tracking ID:</strong> ${grievance.trackingId}</p>
        <p><strong>New Status:</strong> ${grievance.status.replace(/_/g, ' ').toUpperCase()}</p>
        <p>Track your grievance: <a href="${process.env.CLIENT_URL}/track/${grievance.trackingId}">Click here</a></p>`,
    },
    assigned: {
      type: 'grievance_assigned',
      title: 'Grievance Assigned',
      message: `Grievance ${grievance.trackingId} has been assigned for resolution.`,
      emailSubject: `Grievance Assigned – ${grievance.trackingId}`,
      emailHtml: `<h2>Your Grievance Has Been Assigned</h2>
        <p>An officer has been assigned to resolve your grievance <strong>${grievance.trackingId}</strong>.</p>`,
    },
    resolved: {
      type: 'grievance_resolved',
      title: 'Grievance Resolved',
      message: `Your grievance ${grievance.trackingId} has been marked as resolved. Please rate your experience.`,
      emailSubject: `Resolved – ${grievance.trackingId}`,
      emailHtml: `<h2>Grievance Resolved</h2>
        <p>We are pleased to inform you that your grievance <strong>${grievance.trackingId}</strong> has been resolved.</p>
        <p>Please share your feedback: <a href="${process.env.CLIENT_URL}/grievances/${grievance._id}/feedback">Rate your experience</a></p>`,
    },
    escalated: {
      type: 'grievance_escalated',
      title: 'Grievance Escalated',
      message: `Your grievance ${grievance.trackingId} has been escalated to critical priority for faster resolution.`,
      emailSubject: `Escalated – ${grievance.trackingId}`,
      emailHtml: `<h2>Grievance Escalated</h2>
        <p>Your grievance <strong>${grievance.trackingId}</strong> has been escalated and marked as critical priority.</p>`,
    },
    comment: {
      type: 'comment_added',
      title: 'New Comment on Your Grievance',
      message: `A new update has been added to your grievance ${grievance.trackingId}.`,
      emailSubject: `New Update – ${grievance.trackingId}`,
      emailHtml: `<h2>New Comment Added</h2>
        <p>There is a new update on your grievance <strong>${grievance.trackingId}</strong>.</p>
        <p>View details: <a href="${process.env.CLIENT_URL}/grievances/${grievance._id}">Click here</a></p>`,
    },
  };

  const config = eventMap[event];
  if (!config) {
    logger.warn(`Unknown grievance notification event: ${event}`);
    return;
  }

  // Find citizen email if needed
  let citizenEmail = null;
  try {
    const User = require('../models/User');
    const citizen = await User.findById(citizenId).select('email');
    citizenEmail = citizen?.email;
  } catch {
    // non-blocking
  }

  await createInAppNotification({
    recipientId: citizenId,
    type: config.type,
    title: config.title,
    message: config.message,
    referenceModel: 'Grievance',
    referenceId: grievance._id,
    sendEmailAlso: !!citizenEmail,
    emailTo: citizenEmail,
    emailSubject: config.emailSubject,
    emailHtml: config.emailHtml,
  });
};

// ─── notifyDepartmentOfficers ──────────────────────────────────────────────────
/**
 * Notifies all active officers in a department about a new/updated grievance.
 */
const notifyDepartmentOfficers = async (departmentId, grievance) => {
  try {
    const User = require('../models/User');
    const officers = await User.find({
      department: departmentId,
      role: { $in: ['officer', 'department_head'] },
      isActive: true,
    }).select('_id');

    const notifications = officers.map((officer) =>
      createInAppNotification({
        recipientId: officer._id,
        type: 'grievance_assigned',
        title: 'New Grievance in Your Department',
        message: `Grievance ${grievance.trackingId} – "${grievance.title}" has been routed to your department.`,
        referenceModel: 'Grievance',
        referenceId: grievance._id,
      })
    );

    await Promise.allSettled(notifications);
    logger.info(`Notified ${officers.length} officer(s) in department ${departmentId}`);
  } catch (err) {
    logger.error(`Department notification error: ${err.message}`);
  }
};

module.exports = {
  sendEmail,
  createInAppNotification,
  sendGrievanceNotification,
  notifyDepartmentOfficers,
};
