const axios = require('axios');

const XIMILAR_FASHION_URL = 'https://api.ximilar.com/tagging/commercial/v2/fashion';

/**
 * Sends a base64-encoded image to the Ximilar Fashion Tagging API.
 * Returns a normalized array of detected clothing items.
 * @param {string} base64Image — raw base64 string (no data: prefix)
 * @returns {Promise<Array>} clothingItems
 */
async function analyzeClothing(base64Image) {
  const response = await axios.post(
    XIMILAR_FASHION_URL,
    {
      records: [{ _base64: base64Image }],
    },
    {
      headers: {
        Authorization: `Token ${process.env.XIMILAR_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const record = response.data?.records?.[0];
  if (!record) throw new Error('Ximilar returned no records');

  const statusCode = record._status?.code;
  if (statusCode !== 200) {
    throw new Error(`Ximilar API error: ${record._status?.text || 'Unknown error'}`);
  }

  // Normalize detected objects into a clean structure
  const clothingItems = (record._objects || []).map((obj) => {
    const allTags = obj._tags || [];

    const color = allTags.find((t) => t.type === 'color')?.name || null;
    const material = allTags.find((t) => t.type === 'material')?.name || null;
    const pattern = allTags.find((t) => t.type === 'pattern')?.name || null;
    const fit = allTags.find((t) => t.type === 'fit')?.name || null;
    const style = allTags.find((t) => t.type === 'style')?.name || null;

    // Top confidence tags (score > 0.3), excluding the typed ones already captured
    const topTags = allTags
      .filter((t) => !['color', 'material', 'pattern', 'fit', 'style'].includes(t.type))
      .filter((t) => t.prob > 0.3)
      .map((t) => t.name);

    return {
      category: obj.name || 'Unknown item',
      color,
      material,
      pattern,
      fit,
      style,
      tags: topTags,
    };
  });

  return clothingItems;
}

module.exports = { analyzeClothing };
