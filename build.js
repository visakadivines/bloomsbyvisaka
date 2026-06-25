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
      if (data.available !== false) {
        products.push({
          name: data.name || '',
          flowers: data.flowers || '',
          category: data.category || 'Wedding',
          img: data.img || '',
          desc: data.desc || data.description || '',
          price: data.price || ''
        });
      }
    } catch(e) {
      console.error('Error reading', file, e);
    }
  });
}

console.log('Found', products.length, 'products in _data/garlands/');

// Read template
const templatePath = path.join(__dirname, 'index.template.html');
let html = fs.readFileSync(templatePath, 'utf8');

// Replace placeholder with actual PRODUCTS array
const productsJS = `const PRODUCTS = ${JSON.stringify(products, null, 2)};`;
html = html.replace('/* __CMS_PRODUCTS__ */', productsJS);

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Build complete — index.html generated with', products.length, 'products');
