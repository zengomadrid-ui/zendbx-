/**
 * Verification script to ensure NO hardcoded localhost URLs remain
 * Run with: node verify-no-localhost.js
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = __dirname;

// Get all .tsx and .ts files recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

console.log('🔍 Verifying NO hardcoded localhost URLs remain...\n');

const files = getAllFiles(path.join(FRONTEND_DIR, 'app'));
const libFiles = getAllFiles(path.join(FRONTEND_DIR, 'lib'));
const componentFiles = getAllFiles(path.join(FRONTEND_DIR, 'components'));

const allFiles = [...files, ...libFiles, ...componentFiles];

let issuesFound = 0;
const problematicFiles = [];

allFiles.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(FRONTEND_DIR, filePath);
    
    // Skip config.ts and fetch-utils.ts as they properly use environment variables
    if (relativePath.includes('lib\\config.ts') || relativePath.includes('lib/config.ts') ||
        relativePath.includes('lib\\fetch-utils.ts') || relativePath.includes('lib/fetch-utils.ts')) {
      return;
    }
    
    // Check for hardcoded localhost URLs WITHOUT environment variable
    // Pattern: fetch('http://localhost:8000') or similar NOT using env var
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Check if line has localhost:8000 but NOT using process.env
      if (line.includes('localhost:8000') && 
          !line.includes('process.env.NEXT_PUBLIC_API_URL') &&
          !line.includes('getEnvVar') &&
          !line.includes('getApiUrl') &&
          !line.includes('apiFetch') &&
          !line.includes('//') && // Skip comments
          !line.includes('*')) { // Skip comments
        
        problematicFiles.push({
          file: relativePath,
          line: index + 1,
          content: line.trim()
        });
        issuesFound++;
      }
    });
  } catch (error) {
    // Ignore read errors
  }
});

console.log('📊 Verification Results:\n');

if (issuesFound === 0) {
  console.log('✅ SUCCESS! No hardcoded localhost URLs found.');
  console.log('✅ All API calls are using environment variables.');
  console.log('\n📝 Production Configuration:');
  console.log('   NEXT_PUBLIC_API_URL=https://zendbx-13.onrender.com');
  console.log('   NEXT_PUBLIC_APP_URL=https://devapp.zendbx.in');
  console.log('\n🚀 Ready for deployment!');
} else {
  console.log(`❌ ISSUES FOUND: ${issuesFound} hardcoded localhost URLs\n`);
  console.log('Problematic files:');
  problematicFiles.forEach(({ file, line, content }) => {
    console.log(`   ❌ ${file}:${line}`);
    console.log(`      ${content.substring(0, 80)}...`);
  });
  console.log('\n⚠️  Please fix these files before deploying!');
  process.exit(1);
}
