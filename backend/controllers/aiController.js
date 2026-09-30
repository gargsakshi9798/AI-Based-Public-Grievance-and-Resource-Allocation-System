const Grievance = require('../models/Grievance');
const {
  classifyGrievance,
  autoRouteToDepartment,
  detectDuplicates,
  generateResolutionSuggestion,
} = require('../services/aiService');

// ─── @POST /api/ai/classify/:grievanceId ─────────────────────────────────────
exports.classifyGrievanceById = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const result = await classifyGrievance(grievance);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/ai/route/:grievanceId ────────────────────────────────────────
exports.routeGrievance = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const department = await autoRouteToDepartment(grievance);
    if (!department) {
      return res.status(200).json({ success: false, message: 'No suitable department found for this category' });
    }

    res.status(200).json({
      success: true,
      message: `Routed to ${department.name}`,
      data: { departmentId: department._id, departmentName: department.name },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/ai/duplicates/:grievanceId ────────────────────────────────────
exports.findDuplicates = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const duplicates = await detectDuplicates(grievance);
    res.status(200).json({ success: true, count: duplicates.length, data: duplicates });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/ai/resolve-suggestion/:grievanceId ────────────────────────────
exports.getResolutionSuggestion = async (req, res, next) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId);
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const suggestion = await generateResolutionSuggestion(grievance);
    res.status(200).json({ success: true, data: { suggestion } });
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/ai/batch-classify ────────────────────────────────────────────
// Admin: re-run AI classification on all unprocessed grievances
exports.batchClassify = async (req, res, next) => {
  try {
    const unprocessed = await Grievance.find({ aiProcessed: false }).limit(50);

    if (unprocessed.length === 0) {
      return res.status(200).json({ success: true, message: 'No unprocessed grievances found' });
    }

    // Fire off classifications without waiting – returns immediately
    Promise.allSettled(unprocessed.map((g) => classifyGrievance(g)));

    res.status(202).json({
      success: true,
      message: `AI classification started for ${unprocessed.length} grievance(s). Processing in background.`,
    });
  } catch (err) {
    next(err);
  }
};
