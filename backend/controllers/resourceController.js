const Resource = require('../models/Resource');
const Allocation = require('../models/Allocation');
const Grievance = require('../models/Grievance');
const { suggestResourceAllocation } = require('../services/aiService');
const logger = require('../config/logger');

// ─── @POST /api/resources ─────────────────────────────────────────────────────
exports.createResource = async (req, res, next) => {
  try {
    const resource = await Resource.create({
      ...req.body,
      managedBy: req.user._id,
    });
    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/resources ──────────────────────────────────────────────────────
exports.getResources = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.department) filter.department = req.query.department;

    // Department heads only see their department's resources
    if (req.user.role === 'department_head') {
      filter.department = req.user.department;
    }

    const [resources, total] = await Promise.all([
      Resource.find(filter)
        .populate('department', 'name code')
        .populate('managedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Resource.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: resources,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/resources/:id ──────────────────────────────────────────────────
exports.getResourceById = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('department', 'name code')
      .populate('managedBy', 'name email')
      .populate('allocations.allocatedBy', 'name email')
      .populate('allocations.grievance', 'trackingId title status');

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    res.status(200).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/resources/:id ────────────────────────────────────────────────
exports.updateResource = async (req, res, next) => {
  try {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('department', 'name code');

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    res.status(200).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
};

// ─── @DELETE /api/resources/:id ───────────────────────────────────────────────
exports.deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const activeAllocations = resource.allocations.filter((a) => a.isActive);
    if (activeAllocations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete resource with active allocations',
      });
    }

    await resource.deleteOne();
    res.status(200).json({ success: true, message: 'Resource deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/resources/allocate ───────────────────────────────────────────
// Allocate a resource to a grievance
exports.allocateResource = async (req, res, next) => {
  try {
    const { resourceId, grievanceId, quantityOrAmount, purpose, startDate, endDate } = req.body;

    const [resource, grievance] = await Promise.all([
      Resource.findById(resourceId),
      Grievance.findById(grievanceId),
    ]);

    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    if (!grievance) return res.status(404).json({ success: false, message: 'Grievance not found' });

    // Availability check
    if (resource.type !== 'financial') {
      if (resource.quantity.available < quantityOrAmount) {
        return res.status(400).json({
          success: false,
          message: `Only ${resource.quantity.available} units available`,
        });
      }
      resource.quantity.allocated += quantityOrAmount;
    } else {
      const remaining = resource.budget.total - resource.budget.allocated;
      if (remaining < quantityOrAmount) {
        return res.status(400).json({
          success: false,
          message: `Only ${remaining} ${resource.budget.currency} remaining in budget`,
        });
      }
      resource.budget.allocated += quantityOrAmount;
    }

    // Push to embedded allocation log
    resource.allocations.push({
      grievance: grievanceId,
      allocatedBy: req.user._id,
      quantityOrAmount,
      purpose,
    });

    await resource.save();

    // Create standalone allocation record
    const allocation = await Allocation.create({
      resource: resourceId,
      grievance: grievanceId,
      department: resource.department,
      allocatedBy: req.user._id,
      quantityOrAmount,
      purpose,
      startDate,
      endDate,
      status: req.user.role === 'admin' ? 'approved' : 'pending_approval',
    });

    res.status(201).json({ success: true, data: allocation });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/resources/allocations/:id/release ───────────────────────────
exports.releaseAllocation = async (req, res, next) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    const resource = await Resource.findById(allocation.resource);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    // Reverse the quantity / budget
    if (resource.type !== 'financial') {
      resource.quantity.allocated = Math.max(0, resource.quantity.allocated - allocation.quantityOrAmount);
    } else {
      resource.budget.allocated = Math.max(0, resource.budget.allocated - allocation.quantityOrAmount);
    }

    // Mark embedded record as released
    const embedded = resource.allocations.id(allocation._id);
    if (embedded) {
      embedded.isActive = false;
      embedded.releasedAt = new Date();
    }

    allocation.status = 'completed';
    allocation.completedAt = new Date();

    await Promise.all([resource.save(), allocation.save()]);

    res.status(200).json({ success: true, message: 'Resource released successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @PATCH /api/resources/allocations/:id/approve ───────────────────────────
exports.approveAllocation = async (req, res, next) => {
  try {
    const allocation = await Allocation.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: req.user._id },
      { new: true }
    )
      .populate('resource', 'name type')
      .populate('grievance', 'trackingId title')
      .populate('department', 'name');

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    res.status(200).json({ success: true, data: allocation });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/resources/allocations ─────────────────────────────────────────
exports.getAllocations = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.grievance) filter.grievance = req.query.grievance;
    if (req.user.role === 'department_head') filter.department = req.user.department;

    const [allocations, total] = await Promise.all([
      Allocation.find(filter)
        .populate('resource', 'name type')
        .populate('grievance', 'trackingId title status')
        .populate('department', 'name')
        .populate('allocatedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Allocation.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: allocations,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/resources/suggest/:grievanceId ─────────────────────────────────
// AI-powered resource suggestion for a given grievance
exports.suggestResources = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId)
      .populate('department', 'name');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const suggestions = await suggestResourceAllocation(grievance);

    res.status(200).json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
};
