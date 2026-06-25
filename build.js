const fs = require('fs');
const path = require('path');

// Read all garland JSON files
const garlandsDir = path.join(__dirname, '_data', 'garlands');
let products = [];

if (fs.existsSync(garlandsDir)) {
  const files = fs.readdirSync(garlandsDir).filter(f => f.endsWith('.json'));
  files.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(garlandsDir, file), 'utf8'));
      products.push(data);
    } catch(e) {
      console.error('Error reading', file, e);
    }
  });
}

// If no CMS products yet, use defaults
if (products.length === 0) {
  console.log('No CMS products found, using defaults from template');
}

// Read template
let html = fs.readFileSync(path.join(__dirname, 'index.template.html'), 'utf8');

// Build PRODUCTS array from CMS data
const productsJS = products.length > 0
  ? `const PRODUCTS = ${JSON.stringify(products.map(p => ({
      name: p.name || '',
      flowers: p.flowers || p.description || '',
      category: p.category || 'Wedding',
      img: p.photo || p.img || '',
      desc: p.description || p.desc || '',
      price: p.price || ''
    })), null, 2)};`
  : null;

if (productsJS) {
  html = html.replace('/* __CMS_PRODUCTS__ */', productsJS);
} else {
  html = html.replace('/* __CMS_PRODUCTS__ */', '');
}

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Build complete — index.html generated with', products.length, 'CMS products');
