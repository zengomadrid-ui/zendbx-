/**
 * Script to update all references from old backend URL to new backend URL
 * Old: https://zendbx-13.onrender.com
 * New: https://zendbx-2-zpp9.onrender.com
 */

const fs = require('fs');
const path = require('path');

const OLD_URL = 'zendbx-13.onrender.com';
const NEW_URL = 'zendbx-2-zpp9.onrender.com';

// Files to update (documentation and config files)
const filesToUpdate = [
  'DEPLOYMENT_SUMMARY.md',
  'DEPLOYMENT_CHECKLIST.md',
  'LOCALHOST_ELIMINATION_COMPLETE.md',
  'FINAL_COMMIT_MESSAGE.txt',
  'CORS_AND_500_ERROR_FIX.md',
  'DATABASE_CONNECTION_FIX.md',
  'RENDER_DEPLOYMENT_GUIDE.md',
  'SCHEMA_MIGRATION_FIX.md',
  'PROJECT_SCHEMA_FIX.md',
  'COMPLETE_DEPLOYMENT_FIX.md',
  'PRODUCTION_DEPLOYMENT_READY.md',
  'EMERGENCY_CORS_FIX.md',
  'DEPLOYMENT_ISSUES_ANALYSIS.md',
  'BACKEND_ISSUES_ANALYSIS.md',
];

let totalReplacements = 0;
let filesUpdated = 0;

console.log('🔄 Updating backend URL references...\n');
console.log(`   Old: ${OLD_URL}`);
console.log(`   New: ${NEW_URL}\n`);

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Replace all occurrences (both http and https, with and without wss)
    const httpPattern = new RegExp(`https://${OLD_URL}`, 'g');
    const wssPattern = new RegExp(`wss://${OLD_URL}`, 'g');
    const plainPattern = new RegExp(OLD_URL, 'g');
    
    content = content.replace(httpPattern, `https://${NEW_URL}`);
    content = content.replace(wssPattern, `wss://${NEW_URL}`);
    content = content.replace(plainPattern, NEW_URL);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const count = (originalContent.match(new RegExp(OLD_URL, 'g')) || []).length;
      console.log(`✅ Updated ${file} (${count} replacements)`);
      totalReplacements += count;
      filesUpdated++;
    } else {
      console.log(`   ${file} (no changes needed)`);
    }
  } catch (err) {
    console.error(`❌ Error updating ${file}:`, err.message);
  }
});

console.log(`\n✨ Complete!`);
console.log(`   Files updated: ${filesUpdated}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log(`\n📝 Next steps:`);
console.log(`   1. Verify frontend/.env.production has the new URL`);
console.log(`   2. Update Vercel environment variables:`);
console.log(`      NEXT_PUBLIC_API_URL=https://${NEW_URL}`);
console.log(`      NEXT_PUBLIC_WS_URL=wss://${NEW_URL}`);
console.log(`   3. Redeploy frontend with CLEAR BUILD CACHE`);
console.log(`   4. Test all API endpoints`);
