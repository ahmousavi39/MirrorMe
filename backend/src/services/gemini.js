const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Sends the outfit photo + Ximilar clothing data to Gemini 1.5 Flash.
 * Returns a structured rating with score, feedback and suggestions.
 *
 * @param {string} base64Image — raw base64 string
 * @param {Array}  clothingItems — output from ximilar.analyzeClothing()
 * @param {string} mimeType — e.g. 'image/jpeg'
 * @returns {Promise<{ score: number, feedback: string, suggestions: string[] }>}
 */
async function rateOutfit(base64Image, clothingItems, mimeType = 'image/jpeg', occasion = null, userProfile = {}) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  // Build clothing description
  const clothingDescription =
    clothingItems.length > 0
      ? clothingItems
          .map((item) => {
            const details = [item.color, item.material, item.pattern, item.fit, item.style]
              .filter(Boolean)
              .join(', ');
            return `• ${item.category}${details ? ` (${details})` : ''}`;
          })
          .join('\n')
      : '• No specific clothing items detected — please analyze the full outfit from the image.';

  // Build user profile context
  const profileLines = [];
  if (userProfile.name)   profileLines.push(`Name: ${userProfile.name}`);
  if (userProfile.sex)    profileLines.push(`Sex: ${userProfile.sex}`);
  if (userProfile.age)    profileLines.push(`Age: ${userProfile.age}`);
  if (userProfile.heightCm) profileLines.push(`Height: ${userProfile.heightCm} cm`);
  if (userProfile.weightKg) profileLines.push(`Weight: ${userProfile.weightKg} kg`);
  if (userProfile.styleCategories && userProfile.styleCategories.length > 0) {
    profileLines.push(`Style preferences: ${userProfile.styleCategories.join(', ')}`);
  }
  const profileSection = profileLines.length > 0
    ? `User profile:\n${profileLines.map(l => `• ${l}`).join('\n')}`
    : 'No user profile provided.';

  // Occasion context
  const occasionMap = {
    casual:    'a casual day out (errands, hanging with friends, shopping)',
    work:      'a work / office day (professional environment)',
    school:    'school or university (student environment)',
    date:      'a romantic date (first date or anniversary dinner)',
    night_out: 'a night out (bar, club, or party)',
    interview: 'a job interview (formal, high-stakes first impression)',
    formal:    'a formal event (wedding, gala, or black-tie)',
    sport:     'sport or gym (active, performance-focused)',
    travel:    'travel (airport, long trip, comfort-focused)',
  };
  const occasionLine = occasion && occasionMap[occasion]
    ? `Primary occasion the user chose: ${occasionMap[occasion]}.`
    : 'No specific occasion chosen — give a general rating.';

  const allOccasionsList = Object.entries(occasionMap)
    .map(([key, desc]) => `  "${key}": /* score for ${desc} */`)
    .join('\n');

  const prompt = `You are a professional fashion stylist with 10+ years of experience.

${profileSection}

${occasionLine}

Clothing items detected:
${clothingDescription}

Use the user's body measurements, age, sex and style preferences to give highly personalised feedback. Factor in what flatters their body type, suits their age, matches their stated style preferences, and fits the occasion.

Also score how well this outfit works for EVERY occasion listed in "occasionScores".

Respond ONLY with valid JSON in this EXACT format — no markdown, no explanation, no extra text:
{
  "score": 7.5,
  "feedback": "2-3 sentences of personalised, honest assessment referencing the user's profile and the primary occasion.",
  "suggestions": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3",
    "Specific actionable tip 4"
  ],
  "occasionScores": {
${allOccasionsList}
  }
}

Rules:
- score: overall rating for the primary occasion (or general if none chosen), 1.0–10.0, one decimal.
- feedback: reference specific items, the primary occasion, and at least one profile detail.
- suggestions: exactly 4 tips tailored to the primary occasion + user profile, each starting with an action verb.
- occasionScores: a score 1.0–10.0 (one decimal) for EVERY occasion key — how well this exact outfit works for that context.
- Keep language simple, warm and practical.`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const rawText = result.response.text().trim();

  // Extract JSON — handles cases where Gemini wraps it in markdown
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini did not return parseable JSON. Raw: ${rawText.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate structure
  if (
    typeof parsed.score !== 'number' ||
    typeof parsed.feedback !== 'string' ||
    !Array.isArray(parsed.suggestions)
  ) {
    throw new Error('Gemini JSON missing required fields');
  }

  // Normalise occasionScores — clamp each to 1–10, fill missing keys with the overall score
  const ALL_OCCASIONS = ['casual', 'work', 'school', 'date', 'night_out', 'interview', 'formal', 'sport', 'travel'];
  const rawScores = parsed.occasionScores || {};
  const occasionScores = {};
  for (const key of ALL_OCCASIONS) {
    const v = rawScores[key];
    occasionScores[key] = typeof v === 'number' ? Math.min(10, Math.max(1, v)) : parsed.score;
  }

  return {
    score: Math.min(10, Math.max(1, parsed.score)),
    feedback: parsed.feedback,
    suggestions: parsed.suggestions.slice(0, 4),
    occasionScores,
  };
}

/**
 * Fallback: when Ximilar is unavailable, use Gemini vision to extract
 * clothing items in the same structure that analyzeClothing() returns.
 *
 * @param {string} base64Image — raw base64 string
 * @param {string} mimeType — e.g. 'image/jpeg'
 * @returns {Promise<Array>} clothingItems
 */
async function extractClothingFromImage(base64Image, mimeType = 'image/jpeg') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are a fashion AI visual detector. Analyze the outfit in this photo and list every distinct clothing item you can see.

Return a JSON object with an "items" array. Each item must have these fields:
- category (string): garment name, e.g. "Jeans", "Sneakers", "Hoodie", "Dress"
- color (string or null): dominant color
- material (string or null): fabric, e.g. "cotton", "denim", "leather"
- pattern (string or null): e.g. "solid", "striped", "floral", "plaid"
- fit (string or null): e.g. "slim", "regular", "oversized", "baggy"
- style (string or null): e.g. "casual", "formal", "streetwear", "sporty"
- tags (array of strings): other notable attributes like "crew neck", "logo print"

If no clothing is clearly visible, return {"items":[]}.`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const rawText = result.response.text().trim();

  // Strip markdown fences if present, then find the JSON object
  const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Gemini clothing extraction raw response:', rawText.slice(0, 300));
    throw new Error('Gemini clothing extraction did not return parseable JSON');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Gemini clothing extraction JSON.parse failed: ${e.message}`);
  }

  return Array.isArray(parsed.items) ? parsed.items : [];
}

module.exports = { rateOutfit, extractClothingFromImage };
