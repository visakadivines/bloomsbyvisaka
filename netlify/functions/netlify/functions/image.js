const { MongoClient, ObjectId } = require('mongodb');

let cachedClient = null;

exports.handler = async (event) => {
  const id = event.path.split('/').pop();

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(process.env.MONGODB_URI);
      await cachedClient.connect();
    }
    const db = cachedClient.db(process.env.MONGODB_DB || 'bloomsbyvisaka');
    const img = await db.collection('images').findOne({ _id: new ObjectId(id) });

    if (!img) return { statusCode: 404, body: 'Not found' };

    return {
      statusCode: 200,
      headers: { 'Content-Type': img.mimeType, 'Cache-Control': 'public, max-age=31536000' },
      body: img.data,
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
