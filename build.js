const fs = require('fs');
const path = require('path');

// Read all garland files - both JSON and MD (Netlify CMS uses MD by default)
const garlandsDir = path.join(__dirname, '_data', 'garlands');
let products = [];

if (fs.existsSync(garlandsDir)) {
  const files = fs.readdirSync(garlandsDir).filter(f => f.endsWith('.json') || f.endsWith('.md'));
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(path.join(garlandsDir, file), 'utf8');
      let data = {};
      
      if (file.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (file.endsWith('.md')) {
        // Parse frontmatter from markdown file
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const fm = fmMatch[1];
          // Parse each line as key: value
          fm.split('\n').forEach(line => {
            const colonIdx = line.indexOf(':');
            if (colonIdx > -1) {
              const key = line.substring(0, colonIdx).trim();
              let val = line.substring(colonIdx + 1).trim();
              // Remove quotes
              if ((val.startsWith('"') && val.endsWith('"')) || 
                  (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              // Parse booleans
              if (val === 'true') val = true;
              if (val === 'false') val = false;
              data[key] = val;
            }
          });
          // Get body as desc if no desc in frontmatter
          const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
          if (body && !data.desc) data.desc = body;
        }
      }
      
      if (data.available !== false && data.name) {
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
