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
      maxOutputTokens: 2048,
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

Analyse the photo focusing on the STYLE ITSELF — fit, proportions, color harmony, pattern mixing, layering and overall combination. Then factor in how well it matches the occasion and the user's profile.

Also extract up to 5 dominant outfit colors as hex codes for a color palette.

Respond ONLY with valid JSON in this EXACT format — no markdown, no explanation, no extra text:
{
  "score": 7.5,
  "feedback": "2-3 sentences focused on fit, color combination and overall styling — then relate it to the occasion and one profile detail.",
  "styleTips": [
    "Specific tip about fit or proportions",
    "Specific tip about color or pattern",
    "Specific tip about a piece or combination"
  ],
  "occasionTips": [
    "Specific tip about how to adapt this outfit for the chosen occasion",
    "Specific tip about an accessory or swap that suits the event better"
  ],
  "colorPalette": ["#1a1a2e", "#e8c4a0", "#4a4a4a"],
  "occasionScores": {
${allOccasionsList}
  }
}

Rules:
- score: 1.0–10.0, one decimal. IMPORTANT: if the user chose an occasion, "score" MUST be identical to occasionScores["${occasion || ''}"] — they represent the same rating. If no occasion was chosen, score the overall style.
- feedback: ALWAYS open with a style observation (fit / color combo / proportions) before mentioning occasion.
- styleTips: 2–4 tips purely about improving the style itself — fit, proportions, color harmony, pattern mixing, layering. Each starts with an action verb.
- occasionTips: 1–3 tips about adapting the outfit specifically for the chosen event/occasion context. If no occasion was chosen, give general versatility tips. Each starts with an action verb.
- colorPalette: array of 1–5 hex color strings (e.g. "#ffffff") representing the main colors in the outfit. Exact hex, no names.
- occasionScores: CRITICAL — these scores must be GROUNDED in the actual outfit quality. First establish an honest base style score (fit, color, proportions). Then for each occasion, ask: does this specific outfit work for that context? Adjust ±2 points max from the base. A mediocre outfit (5–6) cannot score 8+ for any occasion. A poor fit cannot be saved by a good occasion match. Scores should feel realistic and consistent — the selected occasion score MUST equal "score".
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
    !Array.isArray(parsed.styleTips) ||
    !Array.isArray(parsed.occasionTips)
  ) {
    throw new Error('Gemini JSON missing required fields');
  }

  // Normalise occasionScores
  const ALL_OCCASIONS = ['casual', 'work', 'school', 'date', 'night_out', 'interview', 'formal', 'sport', 'travel'];
  const rawScores = parsed.occasionScores || {};
  const occasionScores = {};
  for (const key of ALL_OCCASIONS) {
    const v = rawScores[key];
    occasionScores[key] = typeof v === 'number' ? Math.min(10, Math.max(1, v)) : parsed.score;
  }

  // If the user chose an occasion, force the top-level score to match that occasion's score
  // to prevent the inconsistency where overall score ≠ selected occasion score.
  let finalScore = Math.min(10, Math.max(1, parsed.score));
  if (occasion && occasionScores[occasion] !== undefined) {
    finalScore = occasionScores[occasion];
  }

  // Sanitise colorPalette — keep only valid hex strings
  const rawPalette = Array.isArray(parsed.colorPalette) ? parsed.colorPalette : [];
  const colorPalette = rawPalette
    .filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c))
    .slice(0, 5);

  return {
    score: finalScore,
    feedback: parsed.feedback,
    styleTips: parsed.styleTips.slice(0, 4),
    occasionTips: parsed.occasionTips.slice(0, 3),
    occasionScores,
    colorPalette,
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
  const imagePart = { inlineData: { data: base64Image, mimeType } };

  const attempts = [
    {
      temperature: 0.1,
      prompt: `You are a fashion item detector. Identify every clothing item visible in this photo.

Output ONLY a raw JSON object. No markdown. No code fences. No comments. No extra text.

Schema — each item has exactly these 6 keys:
  "category": string  (e.g. "Jeans", "T-Shirt", "Sneakers", "Hoodie")
  "color":    string or null  (e.g. "black", "white", "navy blue")
  "material": string or null  (e.g. "cotton", "denim", "leather", "polyester")
  "pattern":  string or null  (e.g. "solid", "striped", "floral", "plaid", "checkered")
  "fit":      string or null  (e.g. "slim", "regular", "oversized", "baggy", "fitted")
  "style":    string or null  (e.g. "casual", "formal", "streetwear", "sporty", "preppy")

All values must be plain ASCII strings or null. No arrays. No nested objects. No special characters.

Example output:
{"items":[{"category":"White T-Shirt","color":"white","material":"cotton","pattern":"solid","fit":"regular","style":"casual"},{"category":"Blue Jeans","color":"blue","material":"denim","pattern":"solid","fit":"slim","style":"casual"}]}

If no clothing is visible: {"items":[]}`,
    },
    {
      temperature: 0.0,
      prompt: `List clothing items in this photo as JSON. Output only the JSON, nothing else.
Format: {"items":[{"category":"name","color":"color or null","material":"material or null","pattern":"pattern or null","fit":"fit or null","style":"style or null"}]}
One object per garment. All values are strings or the word null. No arrays inside objects.
If no clothing: {"items":[]}`,
    },
  ];

  let lastError;
  for (const { temperature, prompt } of attempts) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          temperature,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent([prompt, imagePart]);
      const rawText = result.response.text().trim();

      const stripped = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('Gemini clothing: no JSON object found, raw:', rawText.slice(0, 200));
        throw new Error('No JSON object in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.items)) throw new Error('items is not an array');

      const clean = parsed.items.map((item) => ({
        category: typeof item.category === 'string' ? item.category : 'Clothing item',
        color:    typeof item.color    === 'string' ? item.color    : null,
        material: typeof item.material === 'string' ? item.material : null,
        pattern:  typeof item.pattern  === 'string' ? item.pattern  : null,
        fit:      typeof item.fit      === 'string' ? item.fit      : null,
        style:    typeof item.style    === 'string' ? item.style    : null,
        tags:     [],
      }));

      return clean;
    } catch (e) {
      console.warn(`Gemini clothing extraction attempt failed: ${e.message}`);
      lastError = e;
    }
  }

  throw new Error(`Gemini clothing extraction failed after retries: ${lastError?.message}`);
}

module.exports = { rateOutfit, extractClothingFromImage };
