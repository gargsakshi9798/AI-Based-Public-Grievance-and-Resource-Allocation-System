require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Department = require('../models/Department');

const DEPARTMENTS = [
  { name: 'Public Works Department', code: 'PWD', handledCategories: ['infrastructure', 'transportation'], description: 'Roads, buildings, and public works' },
  { name: 'Water Supply Department', code: 'WATER', handledCategories: ['water_supply'], description: 'Drinking water and pipelines' },
  { name: 'Electrical Department', code: 'ELECT', handledCategories: ['electricity'], description: 'Power supply and streetlights' },
  { name: 'Municipal Sanitation Department', code: 'SANIT', handledCategories: ['sanitation', 'environment'], description: 'Garbage, drainage, and cleanliness' },
  { name: 'Health Department', code: 'HEALTH', handledCategories: ['healthcare'], description: 'Public health facilities' },
  { name: 'Education Department', code: 'EDU', handledCategories: ['education'], description: 'Schools and related civic issues' },
  { name: 'Public Safety Department', code: 'SAFETY', handledCategories: ['public_safety'], description: 'Safety and emergency coordination' },
  { name: 'Social Welfare Department', code: 'WELFARE', handledCategories: ['social_welfare'], description: 'Welfare schemes and entitlements' },
  { name: 'Vigilance Department', code: 'VIGIL', handledCategories: ['corruption'], description: 'Integrity complaints' },
  { name: 'General Administration', code: 'ADMIN', handledCategories: ['other'], description: 'Unclassified civic matters' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const dept of DEPARTMENTS) {
    await Department.findOneAndUpdate({ code: dept.code }, dept, { upsert: true, new: true });
    console.log(`Upserted ${dept.code}`);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
