const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
  const auth = (event.headers['authorization'] || '').replace('Bearer ', '');
  if (auth !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  // Image is sent as base64
  try {
    const body = JSON.parse(event.body);
    const { imageData, fileName, mimeType } = body;

    // Store image as base64 in MongoDB (for simplicity)
    // In production, use Cloudinary or similar
    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB || 'bloomsbyvisaka';
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const result = await db.collection('images').insertOne({
      fileName,
      mimeType,
      data: imageData,
      createdAt: new Date()
    });

    await client.close();

    const imageUrl = `/.netlify/functions/image/${result.insertedId}`;
    return { statusCode: 200, headers, body: JSON.stringify({ url: imageUrl }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
