const Department = require('../models/Department');
const User = require('../models/User');
const Grievance = require('../models/Grievance');

// ─── @POST /api/departments ───────────────────────────────────────────────────
exports.createDepartment = async (req, res, next) => {
  try {
    const department = await Department.create(req.body);
    res.status(201).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/departments ────────────────────────────────────────────────────
exports.getDepartments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.category) filter.handledCategories = req.query.category;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { code: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const departments = await Department.find(filter)
      .populate('head', 'name email')
      .sort({ name: 1 });

    res.status(200).json({ success: true, count: departments.length, data: departments });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/departments/:id ────────────────────────────────────────────────
exports.getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name email phone');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.status(200).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/departments/:id ─────────────────────────────────────────────
exports.updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('head', 'name email');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.status(200).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
};

// ─── @DELETE /api/departments/:id ────────────────────────────────────────────
exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Check for active staff
    const staffCount = await User.countDocuments({ department: department._id });
    if (staffCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${staffCount} assigned user(s). Reassign them first.`,
      });
    }

    await department.deleteOne();
    res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/departments/:id/assign-head ─────────────────────────────────
exports.assignHead = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update department head
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { head: userId },
      { new: true }
    ).populate('head', 'name email');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Elevate user role to department_head if needed
    if (user.role !== 'department_head' && user.role !== 'admin') {
      await User.findByIdAndUpdate(userId, {
        role: 'department_head',
        department: department._id,
      });
    }

    res.status(200).json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/departments/:id/officers ──────────────────────────────────────
exports.getDepartmentOfficers = async (req, res, next) => {
  try {
    const officers = await User.find({
      department: req.params.id,
      role: { $in: ['officer', 'department_head'] },
      isActive: true,
    }).select('name email phone role lastLogin');

    res.status(200).json({ success: true, count: officers.length, data: officers });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/departments/:id/grievances ────────────────────────────────────
exports.getDepartmentGrievances = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter = { department: req.params.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const [grievances, total] = await Promise.all([
      Grievance.find(filter)
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name')
        .sort({ createdAt: -1 })
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

// ─── @GET /api/departments/:id/stats ─────────────────────────────────────────
exports.getDepartmentStats = async (req, res, next) => {
  try {
    const dept = req.params.id;

    const [statusBreakdown, priorityBreakdown, recentTrend] = await Promise.all([
      // Grievances grouped by status
      Grievance.aggregate([
        { $match: { department: require('mongoose').Types.ObjectId.createFromHexString(dept) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Grievances grouped by priority
      Grievance.aggregate([
        { $match: { department: require('mongoose').Types.ObjectId.createFromHexString(dept) } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // Last 30 days daily submission counts
      Grievance.aggregate([
        {
          $match: {
            department: require('mongoose').Types.ObjectId.createFromHexString(dept),
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { statusBreakdown, priorityBreakdown, recentTrend },
    });
  } catch (err) {
    next(err);
  }
};
