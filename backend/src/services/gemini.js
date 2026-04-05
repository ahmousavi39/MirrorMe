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
async function rateOutfit(base64Image, clothingItems, mimeType = 'image/jpeg') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  // Build a human-readable description from Ximilar data
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

  const prompt = `You are a professional fashion stylist with 10+ years of experience dressing clients for real-world scenarios.

A user wants honest, constructive feedback on their outfit. Here are the clothing items detected by AI vision:

${clothingDescription}

Look at the photo carefully and provide your professional assessment.

Respond ONLY with valid JSON in this EXACT format — no markdown, no explanation, no extra text:
{
  "score": 7.5,
  "feedback": "2-3 sentences of honest, specific assessment of the overall look.",
  "suggestions": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3",
    "Specific actionable tip 4"
  ]
}

Rules:
- score: a number between 1.0 and 10.0 with one decimal
- feedback: be honest but encouraging, reference specific items
- suggestions: exactly 4 tips, each starting with an action verb (e.g. "Swap", "Add", "Tuck", "Try")
- Keep language simple and practical`;

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

  return {
    score: Math.min(10, Math.max(1, parsed.score)),
    feedback: parsed.feedback,
    suggestions: parsed.suggestions.slice(0, 4),
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
