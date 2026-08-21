import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const must = (condition, message) => { if (!condition) throw new Error(message); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const walkText = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkText(full));
    else if (/\.(?:ts|tsx|js|mjs|json)$/.test(entry.name)) out.push(fs.readFileSync(full, 'utf8'));
  }
  return out.join('\n');
};

export function validateProBilling(root = 'build-src') {
  const pkg = JSON.parse(read(root, 'apps/mobile/package.json'));
  must(pkg.dependencies?.['react-native-purchases'] === '10.5.0', 'RevenueCat SDK must remain 10.5.0');

  const entitlement = read(root, 'apps/mobile/src/billing/entitlement-policy.ts');
  must(entitlement.includes("PRO_ENTITLEMENT_ID = 'pro'"), 'RevenueCat entitlement must remain pro');

  const appSource = walkText(path.join(root, 'apps/mobile'));
  must(appSource.includes('REVENUECAT_ANDROID_API_KEY'), 'Android RevenueCat public-key configuration hook is missing');
  must(/restorePurchases/.test(appSource), 'Restore Purchases implementation is missing');
  must(/purchasePackage/.test(appSource), 'RevenueCat package purchase implementation is missing');
  must(/getOfferings/.test(appSource), 'RevenueCat offerings loading is missing');
  must(/customerInfo/i.test(appSource), 'RevenueCat customer-info entitlement refresh is missing');
  must(!/\$9\.99|\$79\.99/.test(appSource), 'App source must use localized store price strings, not hard-coded launch prices');

  for (const rel of [
    'scripts/billing-policy.test.mjs',
    'scripts/billing-client-contract.test.mjs',
    'scripts/billing-provider-contract.test.mjs',
    'scripts/pro-paywall-contract.test.mjs',
    'scripts/pro-feature-gates.test.mjs',
    'scripts/pro-more-screen.test.mjs',
    'scripts/pro-release-contract.test.mjs'
  ]) must(exists(root, rel), `Required Pro regression test missing: ${rel}`);

  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateProBilling(process.argv[2] ?? 'build-src');
  console.log('PASS: First Check Pro billing/paywall contract is release-ready for store configuration.');
}
