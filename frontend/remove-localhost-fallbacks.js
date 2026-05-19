/**
 * Script to remove ALL localhost fallbacks from production code
 * This ensures production NEVER falls back to localhost
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = __dirname;

function getAllTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getAllTsxFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

console.log('🔧 Removing ALL localhost fallbacks from code...\n');

const files = getAllTsxFiles(path.join(FRONTEND_DIR, 'app'));
let totalFixed = 0;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // Pattern 1: Remove || "http://localhost:8000" fallbacks
    // Replace: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    // With: process.env.NEXT_PUBLIC_API_URL!
    const pattern1 = /process\.env\.NEXT_PUBLIC_API_URL \|\| "http:\/\/localhost:8000"/g;
    if (pattern1.test(content)) {
      content = content.replace(pattern1, 'process.env.NEXT_PUBLIC_API_URL!');
      modified = true;
    }

    // Pattern 2: Remove || 'http://localhost:8000' fallbacks (single quotes)
    const pattern2 = /process\.env\.NEXT_PUBLIC_API_URL \|\| 'http:\/\/localhost:8000'/g;
    if (pattern2.test(content)) {
      content = content.replace(pattern2, 'process.env.NEXT_PUBLIC_API_URL!');
      modified = true;
    }

    // Pattern 3: Remove || "http://localhost:3001" fallbacks (WebSocket)
    const pattern3 = /process\.env\.NEXT_PUBLIC_WS_URL \|\| "http:\/\/localhost:3001"/g;
    if (pattern3.test(content)) {
      content = content.replace(pattern3, 'process.env.NEXT_PUBLIC_WS_URL!');
      modified = true;
    }

    // Pattern 4: Remove || 'http://localhost:3001' fallbacks (WebSocket, single quotes)
    const pattern4 = /process\.env\.NEXT_PUBLIC_WS_URL \|\| 'http:\/\/localhost:3001'/g;
    if (pattern4.test(content)) {
      content = content.replace(pattern4, 'process.env.NEXT_PUBLIC_WS_URL!');
      modified = true;
    }

    if (modified && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const relativePath = path.relative(FRONTEND_DIR, filePath);
      console.log(`✅ Fixed: ${relativePath}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Fixed: ${totalFixed} files`);
console.log('\n✨ Done! All localhost fallbacks removed.');
console.log('⚠️  Production will now REQUIRE environment variables to be set.');
