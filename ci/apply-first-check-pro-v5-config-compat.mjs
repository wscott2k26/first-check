import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'build-src';
const file = path.join(root, 'apps/mobile/app.config.ts');
if (!fs.existsSync(file)) {
  console.log('No legacy app.config.ts present; app.json remains authoritative.');
  process.exit(0);
}

let source = fs.readFileSync(file, 'utf8');

const replaceOrThrow = (regex, replacement, label) => {
  if (!regex.test(source)) throw new Error(`Legacy app.config.ts missing ${label}`);
  source = source.replace(regex, replacement);
};

replaceOrThrow(/version\s*:\s*['"][^'"]+['"]/, "version:'1.1.0'", 'app version');

if (/versionCode\s*:\s*\d+/.test(source)) {
  source = source.replace(/versionCode\s*:\s*\d+/, 'versionCode:3');
} else if (/android\s*:\s*{/.test(source)) {
  source = source.replace(/android\s*:\s*{/, 'android:{versionCode:3,');
} else {
  throw new Error('Legacy app.config.ts missing android config block');
}

if (/buildNumber\s*:\s*['"][^'"]+['"]/.test(source)) {
  source = source.replace(/buildNumber\s*:\s*['"][^'"]+['"]/, "buildNumber:'1'");
} else if (/ios\s*:\s*{/.test(source)) {
  source = source.replace(/ios\s*:\s*{/, "ios:{buildNumber:'1',");
} else {
  throw new Error('Legacy app.config.ts missing iOS config block');
}

fs.writeFileSync(file, source);
const verified = fs.readFileSync(file, 'utf8');
if (!/version\s*:\s*['"]1\.1\.0['"]/.test(verified)) throw new Error('Pro V5 app version not applied');
if (!/versionCode\s*:\s*3\b/.test(verified)) throw new Error('Pro V5 Android versionCode 3 not applied');
if (!/buildNumber\s*:\s*['"]1['"]/.test(verified)) throw new Error('Pro V5 iOS buildNumber 1 not applied');
if (!verified.includes('com.stormandme.firstcheck')) throw new Error('First Check identity drift in legacy app config');
console.log('Legacy Expo config advanced to First Check Pro v1.1.0 / Android 3 / iOS 1.');
