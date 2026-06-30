const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'bloomsbyvisaka';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

let cachedClient = null;

async function getDb() {
  if (cachedClient) {
    try {
      // Quick health check - ping the connection
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient.db(DB_NAME);
    } catch (err) {
      // Connection is dead, discard it and reconnect
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function unauthorized() {
  return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: 'Unauthorized' }) };
}

function checkAuth(event) {
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return token === ADMIN_PASSWORD;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '');
  const method = event.httpMethod;

  try {
    const db = await getDb();

    // PUBLIC: Get published products
    if (path === '/products' && method === 'GET') {
      const status = event.queryStringParameters?.status;
      const query = status ? { status } : { status: 'published' };
      const products = await db.collection('products').find(query).sort({ sortOrder: 1, createdAt: -1 }).toArray();
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(products) };
    }

    // PUBLIC: Submit enquiry
    if (path === '/enquiries' && method === 'POST') {
      const body = JSON.parse(event.body);
      const enquiry = {
        ...body,
        status: 'new',
        createdAt: new Date()
      };
      await db.collection('enquiries').insertOne(enquiry);
      return { statusCode: 201, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    }

    // All routes below require auth
    if (!checkAuth(event)) return unauthorized();

    // ADMIN: Get all products
    if (path === '/admin/products' && method === 'GET') {
      const products = await db.collection('products').find({}).sort({ sortOrder: 1, createdAt: -1 }).toArray();
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(products) };
    }

    // ADMIN: Create product
    if (path === '/admin/products' && method === 'POST') {
      const body = JSON.parse(event.body);
      const product = { ...body, createdAt: new Date(), updatedAt: new Date(), sortOrder: body.sortOrder || 0 };
      const result = await db.collection('products').insertOne(product);
      return { statusCode: 201, headers: corsHeaders(), body: JSON.stringify({ _id: result.insertedId, ...product }) };
    }

    // ADMIN: Update product
    if (path.startsWith('/admin/products/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = JSON.parse(event.body);
      delete body._id;
      body.updatedAt = new Date();
      await db.collection('products').updateOne({ _id: new ObjectId(id) }, { $set: body });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    }

    // ADMIN: Delete product
    if (path.startsWith('/admin/products/') && method === 'DELETE') {
      const id = path.split('/').pop();
      await db.collection('products').deleteOne({ _id: new ObjectId(id) });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    }

    // ADMIN: Get enquiries
    if (path === '/admin/enquiries' && method === 'GET') {
      const enquiries = await db.collection('enquiries').find({}).sort({ createdAt: -1 }).toArray();
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(enquiries) };
    }

    // ADMIN: Update enquiry status
    if (path.startsWith('/admin/enquiries/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = JSON.parse(event.body);
      await db.collection('enquiries').updateOne({ _id: new ObjectId(id) }, { $set: body });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    }

    // ADMIN: Dashboard stats
    if (path === '/admin/stats' && method === 'GET') {
      const [published, drafts, total, newEnquiries] = await Promise.all([
        db.collection('products').countDocuments({ status: 'published' }),
        db.collection('products').countDocuments({ status: 'draft' }),
        db.collection('products').countDocuments(),
        db.collection('enquiries').countDocuments({ status: 'new' })
      ]);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ published, drafts, total, newEnquiries }) };
    }

    return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: 'Not found' }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};
