/**
 * Comprehensive script to replace ALL hardcoded localhost:8000 URLs
 * with environment variable references
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = __dirname;

// Get all .tsx files recursively
function getAllTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next') {
        getAllTsxFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

console.log('🔍 Scanning for hardcoded localhost:8000 URLs...\n');

const files = getAllTsxFiles(path.join(FRONTEND_DIR, 'app'));
let totalFixed = 0;
let totalScanned = 0;

files.forEach(filePath => {
  totalScanned++;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // Check if file contains localhost:8000
    if (!content.includes('localhost:8000')) {
      return;
    }

    // Pattern 1: fetch('http://localhost:8000/...') -> fetch(`${process.env.NEXT_PUBLIC_API_URL}/...`)
    const pattern1 = /fetch\s*\(\s*['"]http:\/\/localhost:8000(\/[^'"]*)['"]/g;
    if (pattern1.test(content)) {
      content = content.replace(
        /fetch\s*\(\s*['"]http:\/\/localhost:8000(\/[^'"]*)['"]/g,
        'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`'
      );
      modified = true;
    }

    // Pattern 2: fetch(`http://localhost:8000/...${var}...`) -> fetch(`${process.env.NEXT_PUBLIC_API_URL}/...${var}...`)
    const pattern2 = /fetch\s*\(\s*`http:\/\/localhost:8000(\/[^`]*)`/g;
    if (pattern2.test(content)) {
      content = content.replace(
        /fetch\s*\(\s*`http:\/\/localhost:8000(\/[^`]*)`/g,
        'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`'
      );
      modified = true;
    }

    // Pattern 3: const url = 'http://localhost:8000/...' -> const url = `${process.env.NEXT_PUBLIC_API_URL}/...`
    const pattern3 = /=\s*['"]http:\/\/localhost:8000(\/[^'"]*)['"]/g;
    if (pattern3.test(content)) {
      content = content.replace(
        /=\s*['"]http:\/\/localhost:8000(\/[^'"]*)['"]/g,
        '= `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`'
      );
      modified = true;
    }

    // Pattern 4: const url = `http://localhost:8000/...${var}...` -> const url = `${process.env.NEXT_PUBLIC_API_URL}/...${var}...`
    const pattern4 = /=\s*`http:\/\/localhost:8000(\/[^`]*)`/g;
    if (pattern4.test(content)) {
      content = content.replace(
        /=\s*`http:\/\/localhost:8000(\/[^`]*)`/g,
        '= `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`'
      );
      modified = true;
    }

    // Pattern 5: const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    // This is already correct, no change needed

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
console.log(`   Scanned: ${totalScanned} files`);
console.log(`   Fixed: ${totalFixed} files`);
console.log('\n✨ Done! All hardcoded URLs have been replaced with environment variables.');
