/**
 * Script to fix all hardcoded localhost URLs in frontend
 * Run with: node fix-hardcoded-urls.js
 */

const fs = require('fs');
const path = require('path');

const replacements = [
  {
    // Fix fetch calls to API
    pattern: /fetch\(['"`]http:\/\/localhost:8000\/(api\/[^'"`]+)['"`]/g,
    replacement: "apiFetch('$1'"
  },
  {
    // Fix WebSocket connections to port 8001
    pattern: /io\(['"`]http:\/\/localhost:8001['"`]/g,
    replacement: "io(getRealtimeWsUrl()"
  },
  {
    // Fix WebSocket connections to port 3001  
    pattern: /io\(['"`]http:\/\/localhost:3001['"`]/g,
    replacement: "io(getRealtimeWsUrl()"
  },
  {
    // Fix OAuth URLs
    pattern: /window\.location\.href\s*=\s*['"`]http:\/\/localhost:8000\/api\/auth\/oauth\/([^\/]+)\/login['"`]/g,
    replacement: "window.location.href = getOAuthUrl('$1')"
  },
  {
    // Fix callback URLs in input fields
    pattern: /value=['"`]http:\/\/localhost:3000\/callback['"`]/g,
    replacement: "value={getCallbackUrl()}"
  }
];

const filesToFix = [
  'app/(auth)/forgot-password/page.tsx',
  'app/(auth)/reset-password/page.tsx',
  'app/(auth)/callback/page.tsx',
  'app/(dashboard)/layout.tsx',
  'app/(dashboard)/dashboard/authentication/page.tsx',
  'app/(dashboard)/dashboard/authentication/users/page.tsx',
  'app/(dashboard)/dashboard/authentication/sessions/page.tsx',
  'app/(dashboard)/dashboard/authentication/providers/page.tsx',
  'app/(dashboard)/dashboard/projects/page.tsx',
  'app/(dashboard)/dashboard/projects/[id]/team/page.tsx',
  'app/(dashboard)/dashboard/projects/[id]/auth/page.tsx',
  'app/(dashboard)/dashboard/projects/[id]/auth/users/page.tsx',
  'app/(dashboard)/dashboard/team/page.tsx',
  'app/(dashboard)/dashboard/sql-editor/page.tsx',
  'app/(dashboard)/dashboard/tables/page.tsx',
  'app/(dashboard)/dashboard/realtime/page.tsx',
  'app/(dashboard)/dashboard/database/tables/page.tsx',
  'app/(dashboard)/dashboard/database/triggers/page.tsx',
  'app/(dashboard)/dashboard/database/functions/page.tsx',
  'app/onboarding/page.tsx'
];

console.log('🔧 Fixing hardcoded URLs in frontend files...\n');

let totalReplacements = 0;

filesToFix.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileReplacements = 0;
  
  replacements.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      fileReplacements += matches.length;
      content = content.replace(pattern, replacement);
    }
  });
  
  if (fileReplacements > 0) {
    // Add import if not present
    if (!content.includes('from @/lib/fetch-utils')) {
      const importLine = "import { apiFetch, getOAuthUrl, getRealtimeWsUrl, getCallbackUrl } from '@/lib/fetch-utils';\n";
      
      // Find the last import statement
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, importLine);
        content = lines.join('\n');
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${file} (${fileReplacements} replacements)`);
    totalReplacements += fileReplacements;
  } else {
    console.log(`✓  ${file} (no changes needed)`);
  }
});

console.log(`\n🎉 Done! Total replacements: ${totalReplacements}`);
