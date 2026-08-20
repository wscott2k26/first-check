import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'build-src';
const p = (rel) => path.join(root, rel);
const read = (rel) => fs.readFileSync(p(rel), 'utf8');
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

must(fs.existsSync(p('apps/mobile/app.json')), 'Pro contract requires apps/mobile/app.json');
const config = JSON.parse(read('apps/mobile/app.json')).expo;
must(config?.version === '1.1.0', 'Pro version must be 1.1.0');
must(config?.android?.versionCode === 4, 'Pro Android versionCode must be 4');
must(config?.ios?.buildNumber === '2', 'Pro iOS buildNumber must be 2');
must(config?.android?.package === 'com.stormandme.firstcheck', 'Android package drifted');
must(config?.ios?.bundleIdentifier === 'com.stormandme.firstcheck', 'iOS bundle identifier drifted');

must(fs.existsSync(p('apps/mobile/app.config.ts')), 'Dynamic Expo config missing');
const dynamic = read('apps/mobile/app.config.ts');
must(/version\s*:\s*['"]1\.1\.0['"]/.test(dynamic), 'Dynamic Expo version must be 1.1.0');
must(/versionCode\s*:\s*4/.test(dynamic), 'Dynamic Expo Android versionCode must be 4');
must(/buildNumber\s*:\s*['"]2['"]/.test(dynamic), 'Dynamic Expo iOS buildNumber must be 2');

must(fs.existsSync(p('apps/mobile/app/index.tsx')), 'Clean-launch root route is missing');
const index = read('apps/mobile/app/index.tsx');
must(index.includes('Redirect href="/sign-in"'), 'Signed-out clean launch must route to sign-in');
must(index.includes('Redirect href="/today"'), 'Signed-in clean launch must route to Today');
const layout = read('apps/mobile/app/_layout.tsx');
must(layout.includes('<Stack.Screen name="index" />'), 'Root route must be explicitly registered');

const pkg = JSON.parse(read('apps/mobile/package.json'));
must(pkg?.dependencies?.['react-native-purchases'] === '10.5.0', 'RevenueCat SDK pin missing');
const entitlement = read('apps/mobile/src/billing/entitlement-policy.ts');
must(entitlement.includes("PRO_ENTITLEMENT_ID = 'pro'"), 'RevenueCat entitlement must remain pro');

console.log('PASS: First Check Pro 1.1.0/code4/build2 retains the verified clean-launch fix and RevenueCat Pro contract.');
