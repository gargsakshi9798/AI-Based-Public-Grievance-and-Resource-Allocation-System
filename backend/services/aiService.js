const OpenAI = require('openai');
const Grievance = require('../models/Grievance');
const Resource = require('../models/Resource');
const Department = require('../models/Department');
const logger = require('../config/logger');

// Lazy-initialise the client so the app still boots even if the key is missing
let openaiClient = null;
const getClient = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

// ─── Valid enums (must match the Grievance model) ─────────────────────────────
const VALID_CATEGORIES = [
  'infrastructure', 'sanitation', 'water_supply', 'electricity',
  'healthcare', 'education', 'public_safety', 'transportation',
  'environment', 'social_welfare', 'corruption', 'other',
];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// ─── Safe JSON parser ─────────────────────────────────────────────────────────
const safeParseJSON = (text) => {
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

// ─── classifyGrievance ────────────────────────────────────────────────────────
/**
 * Uses OpenAI to classify the grievance category, priority, sentiment, and
 * generate a short summary. Persists the results back to the document.
 *
 * @param {import('../models/Grievance')} grievance  Mongoose document
 * @returns {Promise<Object>} The AI result object
 */
const classifyGrievance = async (grievance) => {
  const prompt = `You are an AI assistant for a government public grievance portal.
Analyze the following citizen grievance and return a JSON object with these fields:
- category: one of [${VALID_CATEGORIES.join(', ')}]
- priority: one of [${VALID_PRIORITIES.join(', ')}]
- sentimentScore: a float from -1.0 (very negative) to 1.0 (very positive)
- summary: a concise 1–2 sentence summary (max 150 words)
- subCategory: a short specific sub-category label (e.g. "pothole", "water leakage")
- reasoning: brief explanation of your classification

Grievance Title: ${grievance.title}
Grievance Description: ${grievance.description}
Submitted Category (citizen-chosen): ${grievance.category}

Respond ONLY with valid JSON, no extra text.`;

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = safeParseJSON(content);

    if (!result) {
      logger.warn(`AI classification returned unparseable response for ${grievance.trackingId}`);
      return null;
    }

    // Validate and sanitise
    const aiCategory = VALID_CATEGORIES.includes(result.category) ? result.category : grievance.category;
    const aiPriority = VALID_PRIORITIES.includes(result.priority) ? result.priority : grievance.priority;
    const aiSentimentScore = typeof result.sentimentScore === 'number'
      ? Math.max(-1, Math.min(1, result.sentimentScore))
      : 0;

    // Persist back to grievance
    await Grievance.findByIdAndUpdate(grievance._id, {
      aiCategory,
      aiPriority,
      aiSentimentScore,
      aiSummary: result.summary || '',
      subCategory: result.subCategory || grievance.subCategory,
      // If AI disagrees significantly on priority, escalate
      priority: aiPriority,
      aiProcessed: true,
    });

    logger.info(`AI classification complete for ${grievance.trackingId}: category=${aiCategory}, priority=${aiPriority}`);

    return { aiCategory, aiPriority, aiSentimentScore, summary: result.summary, reasoning: result.reasoning };
  } catch (err) {
    logger.error(`AI classification error for ${grievance.trackingId}: ${err.message}`);
    // Mark as processed even on failure so we don't retry indefinitely
    await Grievance.findByIdAndUpdate(grievance._id, { aiProcessed: true });
    throw err;
  }
};

// ─── suggestResourceAllocation ────────────────────────────────────────────────
/**
 * Suggests which resources should be allocated to resolve a grievance.
 *
 * @param {import('../models/Grievance')} grievance  Mongoose document (populated)
 * @returns {Promise<Array>} Array of resource suggestion objects
 */
const suggestResourceAllocation = async (grievance) => {
  // Fetch available resources for the relevant department
  const deptFilter = grievance.department
    ? { department: grievance.department._id || grievance.department, status: { $ne: 'fully_allocated' } }
    : { status: { $ne: 'fully_allocated' } };

  const availableResources = await Resource.find(deptFilter)
    .populate('department', 'name')
    .select('name type status quantity budget description tags')
    .limit(30)
    .lean();

  if (availableResources.length === 0) {
    return [];
  }

  const resourceList = availableResources.map((r, i) => {
    const avail = r.type === 'financial'
      ? `Budget remaining: ${r.budget.total - r.budget.allocated} ${r.budget.currency}`
      : `Units available: ${r.quantity.available}/${r.quantity.total}`;
    return `${i + 1}. ID: ${r._id} | Name: ${r.name} | Type: ${r.type} | ${avail}`;
  }).join('\n');

  const prompt = `You are an AI resource allocation assistant for a government grievance resolution system.
Given a citizen grievance and a list of available resources, recommend which resources should be allocated to resolve this grievance efficiently.

Grievance:
- Title: ${grievance.title}
- Category: ${grievance.aiCategory || grievance.category}
- Priority: ${grievance.aiPriority || grievance.priority}
- Description: ${grievance.description.substring(0, 500)}

Available Resources:
${resourceList}

Return a JSON array (max 3 items) where each item has:
- resourceId: the MongoDB _id string from the list above
- resourceName: name of the resource
- quantityOrAmount: recommended quantity/amount to allocate (number)
- purpose: specific reason this resource helps resolve the grievance (1 sentence)
- confidenceScore: float 0–1 indicating confidence in this recommendation
- rationale: brief explanation

Respond ONLY with valid JSON array, no extra text.`;

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '';
    const suggestions = safeParseJSON(content);

    if (!Array.isArray(suggestions)) {
      logger.warn(`AI resource suggestion returned invalid format for grievance ${grievance._id}`);
      return [];
    }

    // Validate each suggestion against actual resource IDs
    const validIds = new Set(availableResources.map((r) => r._id.toString()));
    const validated = suggestions
      .filter((s) => s.resourceId && validIds.has(s.resourceId.toString()))
      .map((s) => ({
        ...s,
        confidenceScore: Math.max(0, Math.min(1, parseFloat(s.confidenceScore) || 0)),
        isAiSuggested: true,
      }));

    logger.info(`AI suggested ${validated.length} resource(s) for grievance ${grievance._id}`);
    return validated;
  } catch (err) {
    logger.error(`AI resource suggestion error: ${err.message}`);
    throw err;
  }
};

// ─── autoRouteToDepartment ────────────────────────────────────────────────────
/**
 * Automatically routes a grievance to the correct department based on its category.
 *
 * @param {import('../models/Grievance')} grievance
 * @returns {Promise<import('../models/Department')|null>}
 */
const autoRouteToDepartment = async (grievance) => {
  try {
    const category = grievance.aiCategory || grievance.category;

    // Find the best-fit department by handled categories
    const department = await Department.findOne({
      handledCategories: category,
      isActive: true,
    });

    if (department) {
      await Grievance.findByIdAndUpdate(grievance._id, { department: department._id });
      logger.info(`Auto-routed grievance ${grievance.trackingId} to department: ${department.name}`);
      return department;
    }

    logger.warn(`No department found for category "${category}" — grievance ${grievance.trackingId} unrouted`);
    return null;
  } catch (err) {
    logger.error(`Auto-routing error for ${grievance.trackingId}: ${err.message}`);
    throw err;
  }
};

// ─── detectDuplicates ─────────────────────────────────────────────────────────
/**
 * Uses semantic similarity via OpenAI embeddings to find potential duplicate grievances.
 *
 * @param {import('../models/Grievance')} grievance
 * @returns {Promise<Array>}
 */
const detectDuplicates = async (grievance) => {
  try {
    const client = getClient();

    // Get recent similar grievances (same category, last 90 days)
    const candidates = await Grievance.find({
      _id: { $ne: grievance._id },
      category: grievance.category,
      status: { $nin: ['closed', 'rejected'] },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    })
      .select('_id trackingId title description')
      .limit(20)
      .lean();

    if (candidates.length === 0) return [];

    const prompt = `You are a duplicate-detection assistant for a government grievance portal.
Given a new grievance and a list of existing grievances, identify which existing ones are likely duplicates or very similar issues.

New Grievance:
Title: ${grievance.title}
Description: ${grievance.description.substring(0, 300)}

Existing Grievances:
${candidates.map((c, i) => `${i + 1}. [${c.trackingId}] ${c.title}`).join('\n')}

Return a JSON array of objects for likely duplicates (similarity > 0.75):
- trackingId: the tracking ID
- similarityScore: float 0–1
- reason: one-sentence explanation

If no duplicates, return an empty array [].
Respond ONLY with valid JSON.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '';
    const duplicates = safeParseJSON(content);

    return Array.isArray(duplicates) ? duplicates : [];
  } catch (err) {
    logger.error(`Duplicate detection error: ${err.message}`);
    return [];
  }
};

// ─── generateResolutionSuggestion ────────────────────────────────────────────
/**
 * Generates a suggested resolution action plan for an officer.
 *
 * @param {import('../models/Grievance')} grievance
 * @returns {Promise<string>}
 */
const generateResolutionSuggestion = async (grievance) => {
  const prompt = `You are an expert government officer assistant. Based on the following citizen grievance, provide a concise, actionable resolution plan.

Grievance:
- Title: ${grievance.title}
- Category: ${grievance.aiCategory || grievance.category}
- Priority: ${grievance.aiPriority || grievance.priority}
- Description: ${grievance.description.substring(0, 500)}

Provide a step-by-step resolution plan in plain text (max 200 words). Focus on practical, immediate actions.`;

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content?.trim() || 'No suggestion available.';
  } catch (err) {
    logger.error(`Resolution suggestion error: ${err.message}`);
    throw err;
  }
};

module.exports = {
  classifyGrievance,
  suggestResourceAllocation,
  autoRouteToDepartment,
  detectDuplicates,
  generateResolutionSuggestion,
};
