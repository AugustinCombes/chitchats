const fs = require('fs');
const path = require('path');

const basePath = process.env.EXPO_PUBLIC_BASE_PATH || '/';
const distDir = path.join(__dirname, '..', 'dist');

console.log(`Fixing base paths for GitHub Pages deployment...`);
console.log(`Base path: ${basePath}`);

// Function to fix paths in HTML files
function fixHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix asset paths
  content = content.replace(/src="\/([^"]+)"/g, `src="${basePath}$1"`);
  content = content.replace(/href="\/([^"]+)"/g, `href="${basePath}$1"`);
  content = content.replace(/url\(\/([^)]+)\)/g, `url(${basePath}$1)`);
  
  // Fix font URLs in style tags
  content = content.replace(/url\(\/assets\//g, `url(${basePath}assets/`);
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${path.basename(filePath)}`);
}

// Function to fix paths in JS files
function fixJsFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix asset paths in JavaScript
  content = content.replace(/"\/assets\//g, `"${basePath}assets/`);
  content = content.replace(/"\/\_expo\//g, `"${basePath}_expo/`);
  content = content.replace(/"\/static\//g, `"${basePath}static/`);
  
  // Fix navigation paths
  content = content.replace(/href:"\/conversation"/g, `href:"${basePath}conversation"`);
  content = content.replace(/pathname:"\/conversation"/g, `pathname:"${basePath}conversation"`);
  
  // Fix router paths
  content = content.replace(/\.replace\("\/conversation"\)/g, `.replace("${basePath}conversation")`);
  content = content.replace(/\.push\("\/conversation"\)/g, `.push("${basePath}conversation")`);
  
  // Fix base URL in runtime
  if (basePath !== '/') {
    content = content.replace(/window\.__PUBLIC_PATH__="\/"/g, `window.__PUBLIC_PATH__="${basePath}"`);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${path.basename(filePath)}`);
}

// Fix all HTML files
const htmlFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));
htmlFiles.forEach(file => {
  fixHtmlFile(path.join(distDir, file));
});

// Fix CSS files
const cssDir = path.join(distDir, '_expo', 'static', 'css');
if (fs.existsSync(cssDir)) {
  const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
  cssFiles.forEach(file => {
    let content = fs.readFileSync(path.join(cssDir, file), 'utf8');
    content = content.replace(/url\(\/assets\//g, `url(${basePath}assets/`);
    fs.writeFileSync(path.join(cssDir, file), content);
    console.log(`Fixed CSS: ${file}`);
  });
}

// Function to recursively find and fix JS files
function findAndFixJsFiles(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findAndFixJsFiles(filePath);
    } else if (file.endsWith('.js')) {
      fixJsFile(filePath);
    }
  });
}

// Fix all JS files in dist
if (fs.existsSync(path.join(distDir, '_expo'))) {
  findAndFixJsFiles(path.join(distDir, '_expo'));
}

// Also check for static directory at root
if (fs.existsSync(path.join(distDir, 'static'))) {
  findAndFixJsFiles(path.join(distDir, 'static'));
}

console.log('Base path fixing complete!');