const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'bloomsbyvisaka';

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

exports.handler = async (event) => {
  // Extract image ID from path: /.netlify/functions/image/[id]
  const path = event.path;
  const id = path.split('/').pop();

  if (!id || id.length !== 24) {
    return {
      statusCode: 400,
      body: 'Invalid image ID'
    };
  }

  try {
    const db = await getDb();
    const image = await db.collection('images').findOne({ _id: new ObjectId(id) });

    if (!image) {
      return { statusCode: 404, body: 'Image not found' };
    }

    // Return the image as binary
    return {
      statusCode: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*'
      },
      body: image.data,
      isBase64Encoded: true
    };

  } catch (err) {
    console.error('Image serve error:', err);
    return { statusCode: 500, body: 'Error serving image' };
  }
};
