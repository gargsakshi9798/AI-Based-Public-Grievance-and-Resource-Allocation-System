const mongoose = require('mongoose');
const Grievance = require('../models/Grievance');
const User = require('../models/User');
const Department = require('../models/Department');
const Resource = require('../models/Resource');
const Allocation = require('../models/Allocation');
const Notification = require('../models/Notification');

// ─── @GET /api/admin/dashboard ────────────────────────────────────────────────
// Top-level KPI summary for the admin dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalGrievances,
      pendingGrievances,
      inProgressGrievances,
      resolvedGrievances,
      criticalGrievances,
      escalatedGrievances,
      grievancesThisMonth,
      grievancesLastMonth,
      totalUsers,
      newUsersThisMonth,
      totalDepartments,
      activeDepartments,
      totalResources,
      availableResources,
      pendingAllocations,
      avgResolutionTime,
      satisfactionData,
    ] = await Promise.all([
      Grievance.countDocuments(),
      Grievance.countDocuments({ status: 'pending' }),
      Grievance.countDocuments({ status: 'in_progress' }),
      Grievance.countDocuments({ status: 'resolved' }),
      Grievance.countDocuments({ priority: 'critical', status: { $nin: ['resolved', 'closed'] } }),
      Grievance.countDocuments({ isEscalated: true, status: { $nin: ['resolved', 'closed'] } }),
      Grievance.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Grievance.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Department.countDocuments(),
      Department.countDocuments({ isActive: true }),
      Resource.countDocuments(),
      Resource.countDocuments({ status: 'available' }),
      Allocation.countDocuments({ status: 'pending_approval' }),

      // Average resolution time (in hours) for resolved grievances in last 30 days
      Grievance.aggregate([
        {
          $match: {
            status: 'resolved',
            resolvedAt: { $exists: true },
            createdAt: { $gte: last30Days },
          },
        },
        {
          $project: {
            resolutionHours: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$resolutionHours' } } },
      ]),

      // Average citizen satisfaction rating
      Grievance.aggregate([
        { $match: { citizenRating: { $exists: true, $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$citizenRating' }, count: { $sum: 1 } } },
      ]),
    ]);

    const resolutionRate =
      totalGrievances > 0
        ? parseFloat(((resolvedGrievances / totalGrievances) * 100).toFixed(2))
        : 0;

    const monthlyGrowth =
      grievancesLastMonth > 0
        ? parseFloat(
            (((grievancesThisMonth - grievancesLastMonth) / grievancesLastMonth) * 100).toFixed(2)
          )
        : 0;

    res.status(200).json({
      success: true,
      data: {
        grievances: {
          total: totalGrievances,
          pending: pendingGrievances,
          inProgress: inProgressGrievances,
          resolved: resolvedGrievances,
          critical: criticalGrievances,
          escalated: escalatedGrievances,
          thisMonth: grievancesThisMonth,
          lastMonth: grievancesLastMonth,
          monthlyGrowthPercent: monthlyGrowth,
          resolutionRate,
        },
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
        },
        departments: {
          total: totalDepartments,
          active: activeDepartments,
        },
        resources: {
          total: totalResources,
          available: availableResources,
          pendingAllocations,
        },
        performance: {
          avgResolutionTimeHours: avgResolutionTime[0]?.avg
            ? parseFloat(avgResolutionTime[0].avg.toFixed(2))
            : null,
          avgSatisfactionRating: satisfactionData[0]?.avg
            ? parseFloat(satisfactionData[0].avg.toFixed(2))
            : null,
          satisfactionResponseCount: satisfactionData[0]?.count || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/analytics/grievances ────────────────────────────────────
// Time-series, category, priority, and status breakdown
exports.getGrievanceAnalytics = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      dailyTrend,
      byStatus,
      byPriority,
      byCategory,
      byDepartment,
      topLocations,
      aiAccuracy,
    ] = await Promise.all([
      // Daily submission trend
      Grievance.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            submitted: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // By status
      Grievance.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // By priority
      Grievance.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // By category
      Grievance.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // By department (top 10)
      Grievance.aggregate([
        { $match: { department: { $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $project: { departmentName: '$dept.name', count: 1, resolved: 1 } },
      ]),

      // Top cities/locations
      Grievance.aggregate([
        { $match: { 'location.city': { $ne: null, $ne: '' } } },
        { $group: { _id: '$location.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // AI classification accuracy (where aiCategory matches category)
      Grievance.aggregate([
        { $match: { aiProcessed: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            matching: {
              $sum: { $cond: [{ $eq: ['$category', '$aiCategory'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyTrend,
        byStatus,
        byPriority,
        byCategory,
        byDepartment,
        topLocations,
        aiAccuracy: aiAccuracy[0]
          ? {
              total: aiAccuracy[0].total,
              matching: aiAccuracy[0].matching,
              accuracyPercent: parseFloat(
                ((aiAccuracy[0].matching / aiAccuracy[0].total) * 100).toFixed(2)
              ),
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/analytics/departments ───────────────────────────────────
exports.getDepartmentPerformance = async (req, res, next) => {
  try {
    const performance = await Grievance.aggregate([
      { $match: { department: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          escalated: { $sum: { $cond: ['$isEscalated', 1, 0] } },
          avgRating: { $avg: '$citizenRating' },
          avgResolutionMs: {
            $avg: {
              $cond: [
                { $and: [{ $ifNull: ['$resolvedAt', false] }, { $ifNull: ['$createdAt', false] }] },
                { $subtract: ['$resolvedAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          departmentName: '$department.name',
          departmentCode: '$department.code',
          total: 1,
          resolved: 1,
          pending: 1,
          critical: 1,
          escalated: 1,
          avgRating: { $round: ['$avgRating', 2] },
          avgResolutionHours: {
            $round: [{ $divide: ['$avgResolutionMs', 3600000] }, 2],
          },
          resolutionRate: {
            $round: [{ $multiply: [{ $divide: ['$resolved', '$total'] }, 100] }, 2],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.status(200).json({ success: true, data: performance });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/analytics/resources ─────────────────────────────────────
exports.getResourceAnalytics = async (req, res, next) => {
  try {
    const [byType, byStatus, allocationTrend, topAllocated] = await Promise.all([
      Resource.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Resource.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Allocation.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$quantityOrAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top 5 most allocated resources
      Allocation.aggregate([
        { $group: { _id: '$resource', totalAllocations: { $sum: 1 } } },
        { $sort: { totalAllocations: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'resources', localField: '_id', foreignField: '_id', as: 'resource' } },
        { $unwind: '$resource' },
        { $project: { resourceName: '$resource.name', resourceType: '$resource.type', totalAllocations: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { byType, byStatus, allocationTrend, topAllocated },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/analytics/users ─────────────────────────────────────────
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const [byRole, registrationTrend, activeVsInactive] = await Promise.all([
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      User.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      User.aggregate([
        { $group: { _id: '$isActive', count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { byRole, registrationTrend, activeVsInactive },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/grievances/sla-breaches ─────────────────────────────────
// Grievances that have exceeded their department SLA
exports.getSLABreaches = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const now = new Date();

    // Find open grievances where expectedResolutionDate has passed
    const filter = {
      status: { $in: ['pending', 'under_review', 'in_progress'] },
      expectedResolutionDate: { $lt: now },
    };

    const [breaches, total] = await Promise.all([
      Grievance.find(filter)
        .populate('citizen', 'name email')
        .populate('department', 'name code')
        .populate('assignedTo', 'name email')
        .sort({ expectedResolutionDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Grievance.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: breaches,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/grievances/unassigned ────────────────────────────────────
exports.getUnassignedGrievances = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {
      assignedTo: null,
      status: { $in: ['pending', 'under_review'] },
    };

    const [grievances, total] = await Promise.all([
      Grievance.find(filter)
        .populate('citizen', 'name email')
        .populate('department', 'name')
        .sort({ priority: 1, createdAt: 1 })
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

// ─── @POST /api/admin/grievances/bulk-assign ─────────────────────────────────
exports.bulkAssignGrievances = async (req, res, next) => {
  try {
    const { grievanceIds, assignedTo, departmentId } = req.body;

    if (!Array.isArray(grievanceIds) || grievanceIds.length === 0) {
      return res.status(400).json({ success: false, message: 'grievanceIds array is required' });
    }

    const update = {};
    if (assignedTo) update.assignedTo = assignedTo;
    if (departmentId) update.department = departmentId;
    update.status = 'under_review';

    const result = await Grievance.updateMany(
      { _id: { $in: grievanceIds } },
      { $set: update }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} grievance(s) updated`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/admin/audit-log ────────────────────────────────────────────────
// Simple audit log via status history aggregation
exports.getAuditLog = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const skip = (page - 1) * limit;

    const logs = await Grievance.aggregate([
      { $unwind: '$statusHistory' },
      {
        $project: {
          trackingId: 1,
          title: 1,
          status: '$statusHistory.status',
          changedBy: '$statusHistory.changedBy',
          note: '$statusHistory.note',
          changedAt: '$statusHistory.createdAt',
        },
      },
      { $sort: { changedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'changedBy',
          foreignField: '_id',
          as: 'actor',
        },
      },
      { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          trackingId: 1,
          title: 1,
          status: 1,
          note: 1,
          changedAt: 1,
          actorName: '$actor.name',
          actorRole: '$actor.role',
        },
      },
    ]);

    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/admin/notifications/broadcast ────────────────────────────────
// Send a system notification to all users or a filtered group
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, targetRole } = req.body;

    const filter = { isActive: true };
    if (targetRole) filter.role = targetRole;

    const users = await User.find(filter).select('_id');

    const notifications = users.map((u) => ({
      recipient: u._id,
      type: 'system_alert',
      title,
      message,
      channels: { inApp: true, email: false },
    }));

    await Notification.insertMany(notifications);

    res.status(200).json({
      success: true,
      message: `Broadcast sent to ${users.length} user(s)`,
    });
  } catch (err) {
    next(err);
  }
};
