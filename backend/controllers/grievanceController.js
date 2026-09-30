const Grievance = require('../models/Grievance');
const { classifyGrievance } = require('../services/aiService');
const { sendGrievanceNotification } = require('../services/notificationService');
const logger = require('../config/logger');

// ─── Helper: build filter from query params ────────────────────────────────────
const buildFilter = (query, user) => {
  const filter = {};

  // Citizens can only see their own grievances
  if (user.role === 'citizen') {
    filter.citizen = user._id;
  }

  // Officers see their department or assigned grievances
  if (user.role === 'officer') {
    filter.$or = [{ assignedTo: user._id }, { department: user.department }];
  }

  // Department heads see their department
  if (user.role === 'department_head') {
    filter.department = user.department;
  }

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.department) filter.department = query.department;

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { trackingId: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  return filter;
};

// ─── @POST /api/grievances ────────────────────────────────────────────────────
exports.createGrievance = async (req, res, next) => {
  try {
    const {
      title, description, category, subCategory,
      location, isAnonymous,
    } = req.body;

    // Build attachments list from uploaded files
    const attachments = (req.files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path,
    }));

    const grievance = await Grievance.create({
      title,
      description,
      category,
      subCategory,
      location,
      isAnonymous: isAnonymous || false,
      citizen: req.user._id,
      attachments,
      statusHistory: [{ status: 'pending', changedBy: req.user._id }],
    });

    // Run AI classification asynchronously (don't block response)
    classifyGrievance(grievance).catch((err) =>
      logger.error(`AI classification failed for ${grievance.trackingId}: ${err.message}`)
    );

    // Notify citizen
    sendGrievanceNotification('submitted', grievance, req.user).catch((err) =>
      logger.error(`Notification failed: ${err.message}`)
    );

    res.status(201).json({
      success: true,
      message: 'Grievance submitted successfully',
      data: grievance,
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/grievances ─────────────────────────────────────────────────────
exports.getGrievances = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const filter = buildFilter(req.query, req.user);

    const [grievances, total] = await Promise.all([
      Grievance.find(filter)
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name email')
        .populate('department', 'name code')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Grievance.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: grievances,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/grievances/:id ─────────────────────────────────────────────────
exports.getGrievanceById = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id)
      .populate('citizen', 'name email phone')
      .populate('assignedTo', 'name email')
      .populate('department', 'name code contactEmail')
      .populate('comments.author', 'name role');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    // Citizens may only view their own (unless anonymous tracking by ID)
    if (
      req.user.role === 'citizen' &&
      !grievance.citizen._id.equals(req.user._id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Increment view count
    await Grievance.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.status(200).json({ success: true, data: grievance });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/grievances/track/:trackingId ───────────────────────────────────
exports.trackGrievance = async (req, res, next) => {
  try {
    const grievance = await Grievance.findOne({ trackingId: req.params.trackingId })
      .populate('department', 'name')
      .populate('assignedTo', 'name')
      .select('trackingId title status priority category createdAt resolvedAt statusHistory expectedResolutionDate');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    res.status(200).json({ success: true, data: grievance });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/grievances/:id ───────────────────────────────────────────────
exports.updateGrievance = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    // Citizens can only edit their own pending grievances
    if (req.user.role === 'citizen') {
      if (!grievance.citizen.equals(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (!['pending'].includes(grievance.status)) {
        return res.status(400).json({ success: false, message: 'Cannot edit a grievance that is already being processed' });
      }
      const { title, description, location } = req.body;
      if (title) grievance.title = title;
      if (description) grievance.description = description;
      if (location) grievance.location = location;
    } else {
      // Officers / admins can update more fields
      const { status, priority, assignedTo, department, expectedResolutionDate } = req.body;
      const previousStatus = grievance.status;

      if (status) grievance.status = status;
      if (priority) grievance.priority = priority;
      if (assignedTo !== undefined) grievance.assignedTo = assignedTo;
      if (department !== undefined) grievance.department = department;
      if (expectedResolutionDate) grievance.expectedResolutionDate = expectedResolutionDate;

      if (status === 'resolved') grievance.resolvedAt = new Date();
      if (status === 'closed') grievance.closedAt = new Date();

      if (status && status !== previousStatus) {
        grievance.statusHistory.push({ status, changedBy: req.user._id });
        // Notify citizen
        sendGrievanceNotification('status_update', grievance, req.user).catch((err) =>
          logger.error(`Notification failed: ${err.message}`)
        );
      }
    }

    await grievance.save();

    res.status(200).json({ success: true, data: grievance });
  } catch (err) {
    next(err);
  }
};

// ─── @DELETE /api/grievances/:id ──────────────────────────────────────────────
exports.deleteGrievance = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    // Only admin or the citizen owner (when pending) can delete
    const isCitizenOwner =
      req.user.role === 'citizen' &&
      grievance.citizen.equals(req.user._id) &&
      grievance.status === 'pending';

    if (!isCitizenOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await grievance.deleteOne();
    res.status(200).json({ success: true, message: 'Grievance deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/grievances/:id/comments ──────────────────────────────────────
exports.addComment = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const isInternal = ['officer', 'admin', 'department_head'].includes(req.user.role)
      ? (req.body.isInternal || false)
      : false;

    grievance.comments.push({
      author: req.user._id,
      text: req.body.text,
      isInternal,
    });

    await grievance.save();

    const populated = await grievance.populate('comments.author', 'name role');

    res.status(201).json({
      success: true,
      data: populated.comments[populated.comments.length - 1],
    });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/grievances/:id/upvote ────────────────────────────────────────
exports.toggleUpvote = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const idx = grievance.upvotes.indexOf(req.user._id);
    let action;
    if (idx === -1) {
      grievance.upvotes.push(req.user._id);
      action = 'upvoted';
    } else {
      grievance.upvotes.splice(idx, 1);
      action = 'removed upvote';
    }

    await grievance.save();
    res.status(200).json({ success: true, action, upvoteCount: grievance.upvotes.length });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/grievances/:id/feedback ──────────────────────────────────────
exports.submitFeedback = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (!grievance.citizen.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the submitter can leave feedback' });
    }

    if (grievance.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Feedback can only be given for resolved grievances' });
    }

    grievance.citizenRating = rating;
    grievance.citizenFeedback = feedback;
    await grievance.save();

    res.status(200).json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/grievances/:id/escalate ──────────────────────────────────────
exports.escalateGrievance = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (grievance.isEscalated) {
      return res.status(400).json({ success: false, message: 'Grievance is already escalated' });
    }

    grievance.isEscalated = true;
    grievance.escalatedAt = new Date();
    grievance.escalationReason = req.body.reason || 'Manually escalated';
    grievance.priority = 'critical';

    await grievance.save();

    res.status(200).json({ success: true, message: 'Grievance escalated to critical priority' });
  } catch (err) {
    next(err);
  }
};
