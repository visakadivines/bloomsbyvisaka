const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'bloomsbyvisaka';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

let cachedClient = null;

async function getDb() {
  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient.db(DB_NAME);
    } catch (err) {
      cachedClient = null;
    }
  }
  cachedClient = new MongoClient(MONGO_URI);
  await cachedClient.connect();
  return cachedClient.db(DB_NAME);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check auth
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { imageData, fileName, mimeType } = JSON.parse(event.body);

    if (!imageData || !mimeType) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Missing imageData or mimeType' }) };
    }

    // Validate it's an image
    if (!mimeType.startsWith('image/')) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Only image files are allowed' }) };
    }

    // Check size — base64 is ~33% larger than original, so 5MB original ≈ 6.7MB base64
    if (imageData.length > 7 * 1024 * 1024) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Image too large. Please use an image under 5MB.' }) };
    }

    const db = await getDb();

    const result = await db.collection('images').insertOne({
      data: imageData,
      mimeType,
      fileName: fileName || 'upload',
      createdAt: new Date()
    });

    const imageId = result.insertedId.toString();
    const url = `/.netlify/functions/image/${imageId}`;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ url, id: imageId })
    };

  } catch (err) {
    console.error('Upload error:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};
