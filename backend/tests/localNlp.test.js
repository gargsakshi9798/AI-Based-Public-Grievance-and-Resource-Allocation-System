const { classifyLocal, predictPriority, cleanText } = require('../services/localNlp');

describe('Local NLP classifier (report test cases TC07–TC09)', () => {
  test('cleans complaint text', () => {
    expect(cleanText('  Garbage!!!  ')).toBe('garbage');
  });

  test('TC07 road damage predicts infrastructure', () => {
    const result = classifyLocal('Damaged road', 'There is a large pothole on the main road');
    expect(result.category).toBe('infrastructure');
  });

  test('TC08 water leakage predicts water_supply', () => {
    const result = classifyLocal('Water problem', 'Major water leakage from the municipal pipeline');
    expect(result.category).toBe('water_supply');
  });

  test('open manhole is critical priority', () => {
    expect(predictPriority('Open manhole on the road is dangerous')).toBe('critical');
  });

  test('garbage complaint maps to sanitation', () => {
    const result = classifyLocal(
      'Garbage not collected',
      'Garbage has not been collected from our street for the last four days'
    );
    expect(result.category).toBe('sanitation');
  });
});
