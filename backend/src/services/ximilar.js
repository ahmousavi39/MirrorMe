const axios = require('axios');

const XIMILAR_FASHION_URL = 'https://api.ximilar.com/tagging/fashion/v2/tags';

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

  // The fashion/v2/tags endpoint returns _tags directly on each record object.
  // Each tag has: name, prob, type (category, color, material, etc.)
  const allTags = record._tags || [];

  // Group tags by type to build a single clothing-item-style summary
  const getTag = (type) => {
    const tag = allTags
      .filter((t) => t.type === type)
      .sort((a, b) => b.prob - a.prob)[0];
    return tag ? tag.name : null;
  };

  // If the endpoint detected specific garment objects, use those; otherwise aggregate
  const objects = record._objects;
  if (objects && objects.length > 0) {
    const clothingItems = objects.map((obj) => {
      const tags = obj._tags || [];
      return {
        category: obj.name || 'Unknown item',
        color: tags.find((t) => t.type === 'color')?.name || null,
        material: tags.find((t) => t.type === 'material')?.name || null,
        pattern: tags.find((t) => t.type === 'pattern')?.name || null,
        fit: tags.find((t) => t.type === 'fit')?.name || null,
        style: tags.find((t) => t.type === 'style')?.name || null,
        tags: tags
          .filter((t) => !['color', 'material', 'pattern', 'fit', 'style'].includes(t.type) && t.prob > 0.3)
          .map((t) => t.name),
      };
    });
    return clothingItems;
  }

  // Fallback: build one item from top-level tags
  const categories = allTags
    .filter((t) => t.type === 'category' && t.prob > 0.3)
    .sort((a, b) => b.prob - a.prob)
    .map((t) => t.name);

  const clothingItems = [{
    category: categories[0] || 'Outfit',
    color: getTag('color'),
    material: getTag('material'),
    pattern: getTag('pattern'),
    fit: getTag('fit'),
    style: getTag('style'),
    tags: categories.slice(1),
  }];

  return clothingItems;
}

module.exports = { analyzeClothing };
