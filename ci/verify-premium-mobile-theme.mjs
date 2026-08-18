import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('usage: node verify-premium-mobile-theme.mjs <source-root>');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const tokens = read('packages/ui/src/tokens/colors.ts');
const required = [
  "canvas: '#F6F8FC'",
  "surface900: '#FFFFFF'",
  "surface850: '#F0F4F9'",
  "surface800: '#E3E8EF'",
  "textPrimary: '#111827'",
  "textSecondary: '#526071'",
  "textMuted: '#7D8998'",
  "textOnAccent: '#FFFFFF'",
  "accentIndigo: '#5B67F1'",
  "accentCyan: '#36C5F0'",
];
for (const s of required) if (!tokens.includes(s)) throw new Error(`missing premium token: ${s}`);
if (tokens.includes("canvas: '#070A10'")) throw new Error('legacy dark canvas still present');
const layout = read('apps/mobile/app/_layout.tsx');
if (!layout.includes('<StatusBar style="dark"/>')) throw new Error('status bar is not dark-content for light shell');
const signIn = read('apps/mobile/app/sign-in.tsx');
if (!signIn.includes('Know what’s healthy.')) throw new Error('premium sign-in headline missing');
for (const rel of ['apps/mobile/app/sign-in.tsx','apps/mobile/app/(tabs)/today.tsx']) {
  if (read(rel).includes('Mission Control')) throw new Error(`${rel}: legacy Mission Control copy remains`);
}
const buttonFiles = [
  'apps/mobile/features/evidence/capture-evidence.tsx',
  'apps/mobile/app/(tabs)/ask-ai.tsx',
  'apps/mobile/app/(tabs)/today.tsx',
  'apps/mobile/app/workspace.tsx',
  'apps/mobile/app/report/[reportId].tsx',
  'apps/mobile/app/sign-in.tsx',
];
for (const p of buttonFiles) {
  const t = read(p);
  if (/((?:primary|upload|share)Text):\{color:colors\.textPrimary/.test(t)) throw new Error(`${p}: accent button still uses textPrimary`);
}
console.log('Premium mobile theme contract passed.');
