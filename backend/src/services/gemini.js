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
async function rateOutfit(base64Image, clothingItems, mimeType = 'image/jpeg', occasion = null, userProfile = {}, wardrobeItems = [], locale = 'en') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
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

  // Build wardrobe context
  const wardrobeSection = wardrobeItems.length > 0
    ? `The user's wardrobe (pieces they already own):\n${wardrobeItems
        .map((w) => {
          const details = [w.color, w.material, w.fit, w.style].filter(Boolean).join(', ');
          const clean = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
          const key = `${clean(w.category)}_${clean(w.color)}`;
          return `• [key:${key}] ${w.category}${details ? ` (${details})` : ''}`;
        })
        .join('\n')}`
    : null;

  const allOccasionsList = Object.entries(occasionMap)
    .map(([key, desc]) => `  "${key}": /* score for ${desc} */`)
    .join('\n');

  // Language instruction
  const languageMap = {
    'zh-Hans': 'Simplified Chinese (zh-Hans)',
    'ja': 'Japanese',
    'de': 'German',
    'fr': 'French',
    'es': 'Spanish',
  };
  const languageName = languageMap[locale] || null;
  const languageInstruction = languageName
    ? `IMPORTANT: Write all user-facing text in ${languageName}, including: feedback, styleTips, and occasionTips. ALL JSON keys must remain in English.`
    : '';

  const prompt = `You are a professional fashion stylist with 10+ years of experience.
${languageInstruction ? `\n${languageInstruction}\n` : ''}
${profileSection}

${occasionLine}
${wardrobeSection ? `\n${wardrobeSection}\n` : ''}
Clothing items detected:
${clothingDescription}

Analyse the photo focusing on the STYLE ITSELF — fit, proportions, color harmony, pattern mixing, layering and overall combination. Then factor in how well it matches the occasion and the user's profile.

Also extract up to 5 dominant outfit colors as hex codes for a color palette.

Respond ONLY with valid JSON in this EXACT format — no markdown, no explanation, no extra text:

IF the photo does not contain a visible person wearing clothing (e.g. it's a selfie of a face only, a landscape, an object, or blank), respond with ONLY this:
{"errorCode": "NO_PERSON", "errorMessage": "No person or outfit detected in the photo."}

IF a person is visible but clothing cannot be assessed (e.g. swimwear/underwear only, only a face visible below chin), respond with ONLY this:
{"errorCode": "NO_OUTFIT", "errorMessage": "Could not assess an outfit in this photo. Please upload a full-body or upper-body outfit photo."}

OTHERWISE respond with:
{
  "score": 7.5,
  "feedback": "2-3 sentences focused on fit, color combination and overall styling — then relate it to the occasion and one profile detail.",
  "styleTips": [
    "Specific tip about fit or proportions",
    "Specific tip about color or pattern",
    "Specific tip about a piece or combination"
  ],
  "styleTipRefs": [null, "jeans_blue", null],
  "occasionTips": [
    "Specific tip about how to adapt this outfit for the chosen occasion",
    "Specific tip about an accessory or swap that suits the event better"
  ],
  "occasionTipRefs": [null, "sneakers_white"],
  "colorPalette": ["#1a1a2e", "#e8c4a0", "#4a4a4a"],  /* outfit + skin colors only, no background */
  "clothingItemsLocalized": null,  /* see rule below */
  "occasionScores": {
${allOccasionsList}
  }
}

Rules:
- score: 1.0–10.0, one decimal. IMPORTANT: if the user chose an occasion, "score" MUST be identical to occasionScores["${occasion || ''}"] — they represent the same rating. If no occasion was chosen, score the overall style.
- feedback: ALWAYS open with a style observation (fit / color combo / proportions) before mentioning occasion.
- styleTips: 2–4 tips purely about improving the style itself — fit, proportions, color harmony, pattern mixing, layering. Each starts with an action verb. Focus on what will genuinely improve the look. When a specific wardrobe piece the user already owns would naturally make a good swap or complement (and it actually fits the tip), reference it using its [key:...] label (e.g. "swap for your [key:jeans_blue]") — but only if it's a real improvement. Do not force wardrobe references into every tip; most tips should simply be good style advice.
- styleTipRefs: parallel array to styleTips, same length. For each tip, if you referenced a wardrobe item using its [key:...] label, put that key string here. Otherwise put null. Example: if styleTips has 3 entries and tip index 1 references [key:jeans_blue], then styleTipRefs = [null, "jeans_blue", null].
- occasionTips: 1–3 tips about adapting the outfit specifically for the chosen event/occasion context. If no occasion was chosen, give general versatility tips. Each starts with an action verb. When a wardrobe piece the user owns would be a natural swap or addition for the occasion, mention it by its [key:...] label — but only if it genuinely fits.
- occasionTipRefs: parallel array to occasionTips, same length. For each tip, if you referenced a wardrobe item using its [key:...] label, put that key string here. Otherwise put null.
- colorPalette: array of 1–5 hex color strings representing ONLY the dominant colors of the clothing items and visible skin tone. IGNORE background, walls, furniture, floors, and any non-clothing objects. Focus strictly on what the person is wearing and their skin.
- clothingItemsLocalized: ${languageName ? `describe each detected clothing item's fields (category, color, fit, material, pattern, style) directly in ${languageName} — the same language you used for feedback and styleTips. Do NOT translate from the English detected items; write the values naturally as a native speaker would. Return an array of objects with the same keys. Keep null values as null. JSON keys must stay in English. The array MUST have the same number of objects in the same order as the detected clothing items.` : 'set to null (locale is English).'}
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

  // Handle specific error codes returned by Gemini
  if (parsed.errorCode) {
    const err = new Error(parsed.errorMessage || 'Photo could not be analysed.');
    err.code = parsed.errorCode;
    throw err;
  }

  // Validate structure
  if (
    typeof parsed.score !== 'number' ||
    typeof parsed.feedback !== 'string' ||
    !Array.isArray(parsed.styleTips) ||
    !Array.isArray(parsed.occasionTips)
  ) {
    throw new Error('Gemini JSON missing required fields');
  }

  // Build styleTipRefs — parallel array mapping each tip to a wardrobe key or null
  const rawTipRefs = Array.isArray(parsed.styleTipRefs) ? parsed.styleTipRefs : [];
  const styleTipRefs = parsed.styleTips.slice(0, 4).map((_, i) => {
    const ref = rawTipRefs[i];
    return typeof ref === 'string' ? ref : null;
  });

  // Build occasionTipRefs
  const rawOccasionTipRefs = Array.isArray(parsed.occasionTipRefs) ? parsed.occasionTipRefs : [];
  const occasionTipRefs = parsed.occasionTips.slice(0, 3).map((_, i) => {
    const ref = rawOccasionTipRefs[i];
    return typeof ref === 'string' ? ref : null;
  });

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

  // Extract clothingItemsLocalized directly from the main response (no separate API call)
  let clothingItemsLocalized = null;
  if (
    languageName &&
    Array.isArray(parsed.clothingItemsLocalized) &&
    parsed.clothingItemsLocalized.length === clothingItems.length
  ) {
    clothingItemsLocalized = parsed.clothingItemsLocalized.map((item) => ({
      category: typeof item.category === 'string' ? item.category : null,
      color:    typeof item.color    === 'string' ? item.color    : null,
      fit:      typeof item.fit      === 'string' ? item.fit      : null,
      material: typeof item.material === 'string' ? item.material : null,
      pattern:  typeof item.pattern  === 'string' ? item.pattern  : null,
      style:    typeof item.style    === 'string' ? item.style    : null,
      tags:     [],
    }));
  }

  return {
    score: finalScore,
    feedback: parsed.feedback,
    styleTips: parsed.styleTips.slice(0, 4),
    styleTipRefs,
    occasionTips: parsed.occasionTips.slice(0, 3),
    occasionTipRefs,
    occasionScores,
    colorPalette,
    clothingItemsLocalized,
  };
}

/**
 * Translates the string fields of detected clothing items into a target language.
 * Runs as a separate, focused Gemini call after the main analysis.
 *
 * @param {Array}  items        — clothingItems array (English)
 * @param {string} languageName — e.g. "Simplified Chinese (zh-Hans)"
 * @returns {Promise<Array|null>}
 */
async function translateClothingItems(items, languageName) {
  if (!items || items.length === 0 || !languageName) return null;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  // Build a clean JSON array as input so Gemini knows exactly what to return
  const inputArray = items.map((item) => ({
    category: item.category || null,
    color: item.color || null,
    fit: item.fit || null,
    material: item.material || null,
    pattern: item.pattern || null,
    style: item.style || null,
  }));

  const prompt = `You are a translator. Translate the string field VALUES of each object in the JSON array below from English into ${languageName}.

Rules:
- Keep null values as null.
- Do NOT translate color hex codes (e.g. "#1a1a2e" stays as "#1a1a2e").
- ALL JSON keys must stay exactly in English (category, color, fit, material, pattern, style).
- Return a JSON array with the same number of objects in the same order.

Input:
${JSON.stringify(inputArray)}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // responseMimeType=application/json means the response should be clean JSON,
    // but still try to extract an array in case Gemini wraps it
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) {
        console.warn('translateClothingItems: no JSON array in response:', raw.slice(0, 200));
        return null;
      }
      parsed = JSON.parse(match[0]);
    }

    // Gemini sometimes wraps in { "items": [...] } or similar
    if (!Array.isArray(parsed)) {
      const nested = parsed?.items || parsed?.clothing || parsed?.result || parsed?.data;
      if (Array.isArray(nested)) parsed = nested;
      else {
        console.warn('translateClothingItems: response is not an array:', JSON.stringify(parsed).slice(0, 200));
        return null;
      }
    }

    if (parsed.length !== items.length) {
      console.warn(`translateClothingItems: length mismatch (got ${parsed.length}, expected ${items.length})`);
      return null;
    }

    return parsed.map((item) => ({
      category: typeof item.category === 'string' ? item.category : null,
      color: typeof item.color === 'string' ? item.color : null,
      fit: typeof item.fit === 'string' ? item.fit : null,
      material: typeof item.material === 'string' ? item.material : null,
      pattern: typeof item.pattern === 'string' ? item.pattern : null,
      style: typeof item.style === 'string' ? item.style : null,
      tags: [],
    }));
  } catch (e) {
    console.warn('translateClothingItems failed:', e.message);
    return null;
  }
}

/**
 * Fallback: when Ximilar is unavailable, use Gemini vision to extract
 * clothing items in the same structure that analyzeClothing() returns.
 *
 * @param {string} base64Image — raw base64 string
 * @param {string} mimeType — e.g. 'image/jpeg'
 * @returns {Promise<Array>} clothingItems
 */
async function extractClothingFromImage(base64Image, mimeType = 'image/jpeg', locale = 'en') {
  const imagePart = { inlineData: { data: base64Image, mimeType } };

  const languageMap = {
    'zh-Hans': 'Simplified Chinese (zh-Hans)',
    'ja': 'Japanese',
    'de': 'German',
    'fr': 'French',
    'es': 'Spanish',
  };
  const languageName = languageMap[locale] || null;
  const langInstruction = languageName
    ? `Write all string values (category, color, material, pattern, fit, style) in ${languageName}. ALL JSON keys must stay in English.`
    : '';

  const attempts = [
    {
      temperature: 0.1,
      prompt: `You are a fashion item detector. Identify every clothing item visible in this photo.
${langInstruction ? `\n${langInstruction}\n` : ''}
Output ONLY a raw JSON object. No markdown. No code fences. No comments. No extra text.

Schema — each item has exactly these 6 keys:
  "category": string  (e.g. "Jeans", "T-Shirt", "Sneakers", "Hoodie")
  "color":    string or null  (e.g. "black", "white", "navy blue")
  "material": string or null  (e.g. "cotton", "denim", "leather", "polyester")
  "pattern":  string or null  (e.g. "solid", "striped", "floral", "plaid", "checkered")
  "fit":      string or null  (e.g. "slim", "regular", "oversized", "baggy", "fitted")
  "style":    string or null  (e.g. "casual", "formal", "streetwear", "sporty", "preppy")

All values must be plain strings or null. No arrays. No nested objects.

Example output:
{"items":[{"category":"White T-Shirt","color":"white","material":"cotton","pattern":"solid","fit":"regular","style":"casual"},{"category":"Blue Jeans","color":"blue","material":"denim","pattern":"solid","fit":"slim","style":"casual"}]}

If no clothing is visible: {"items":[]}`,
    },
    {
      temperature: 0.0,
      prompt: `List clothing items in this photo as JSON. Output only the JSON, nothing else.${langInstruction ? ` ${langInstruction}` : ''}
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
