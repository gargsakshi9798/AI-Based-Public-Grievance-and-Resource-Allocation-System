/**
 * Academic NLP classifier (report §15.3 / §16):
 * text cleaning, keyword scoring, category prediction, priority rules,
 * and a confidence score — works without OpenAI.
 */

const CATEGORY_KEYWORDS = {
  infrastructure: ['pothole', 'road', 'bridge', 'footpath', 'pavement', 'manhole', 'building', 'park', 'public property', 'damaged road'],
  sanitation: ['garbage', 'waste', 'trash', 'dump', 'cleanliness', 'sewage', 'dustbin', 'collection', 'filth', 'rubbish'],
  water_supply: ['water', 'tap', 'pipeline', 'leakage', 'shortage', 'borewell', 'tanker', 'drinking water', 'no water'],
  electricity: ['electricity', 'power', 'streetlight', 'street light', 'transformer', 'outage', 'wire', 'pole', 'current', 'blackout'],
  healthcare: ['hospital', 'clinic', 'doctor', 'medicine', 'ambulance', 'health', 'phc', 'vaccination'],
  education: ['school', 'college', 'teacher', 'classroom', 'mid day meal', 'scholarship'],
  public_safety: ['crime', 'theft', 'assault', 'unsafe', 'harassment', 'police', 'accident', 'fire'],
  transportation: ['bus', 'traffic', 'signal', 'parking', 'auto', 'transport', 'junction'],
  environment: ['pollution', 'smoke', 'tree', 'flood', 'waterlogging', 'drain', 'drainage', 'stagnant'],
  social_welfare: ['ration', 'pension', 'aadhaar', 'welfare', 'scheme', 'benefit'],
  corruption: ['bribe', 'corruption', 'extortion', 'illegal', 'harassment by official'],
  other: [],
};

const CRITICAL_TERMS = ['manhole', 'open manhole', 'danger', 'dangerous', 'fire', 'electrocute', 'collapse', 'fatal', 'emergency', 'life threatening'];
const HIGH_TERMS = ['no water', 'three days', 'leakage', 'overflow', 'outage', 'accident', 'blocked drain', 'sewage overflow', 'last four days', 'last five days'];
const LOW_TERMS = ['minor', 'small', 'slight', 'occasionally'];

function cleanText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const stops = new Set(['the', 'a', 'an', 'is', 'are', 'in', 'on', 'of', 'and', 'to', 'for', 'from', 'our', 'my', 'has', 'have', 'been', 'not', 'last']);
  return cleanText(text).split(' ').filter((w) => w.length > 1 && !stops.has(w));
}

function scoreCategories(text) {
  const blob = cleanText(text);
  const scores = {};
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = words.reduce((n, w) => n + (blob.includes(w) ? 1 : 0), 0);
  }
  return scores;
}

function predictPriority(text) {
  const blob = cleanText(text);
  if (CRITICAL_TERMS.some((t) => blob.includes(t))) return 'critical';
  if (HIGH_TERMS.some((t) => blob.includes(t))) return 'high';
  if (LOW_TERMS.some((t) => blob.includes(t))) return 'low';
  return 'medium';
}

function classifyLocal(title, description) {
  const combined = `${title || ''} ${description || ''}`;
  const scores = scoreCategories(combined);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0][1] > 0 ? ranked[0][0] : 'other';
  const total = ranked.reduce((s, [, v]) => s + v, 0) || 1;
  const confidence = Math.min(0.99, ranked[0][1] / total);

  return {
    category: best,
    priority: predictPriority(combined),
    confidenceScore: Number(confidence.toFixed(2)),
    summary: `Local NLP classified this complaint as ${best.replace(/_/g, ' ')}.`,
    method: 'local_nlp',
  };
}

module.exports = {
  cleanText,
  tokenize,
  classifyLocal,
  predictPriority,
};
