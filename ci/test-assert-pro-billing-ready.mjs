import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateProBilling } from './assert-pro-billing-ready.mjs';

const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-check-pro-contract-'));
  const write = (rel, body) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  };
  write('apps/mobile/package.json', JSON.stringify({ dependencies: { 'react-native-purchases': '10.5.0' } }));
  write('apps/mobile/src/billing/entitlement-policy.ts', "export const PRO_ENTITLEMENT_ID = 'pro';\n");
  write('apps/mobile/src/billing/billing-client.ts', `
    const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
    export async function loadBilling(){ return Purchases.getOfferings(); }
    export async function buy(pkg){ return Purchases.purchasePackage(pkg); }
    export async function restore(){ return Purchases.restorePurchases(); }
  `);
  write('apps/mobile/src/billing/billing-provider.tsx', 'const customerInfo = {};');
  write('apps/mobile/app/pro.tsx', 'const noTrialCopy = true;');
  write('apps/mobile/app/(tabs)/ask-ai.tsx', 'First Check Pro');
  write('apps/mobile/app/(tabs)/history.tsx', 'Full operational history');
  write('apps/mobile/app/(tabs)/more.tsx', 'Advanced reports and exports');
  write('apps/mobile/app/workspace/index.tsx', 'Multiple environments');
  for (const name of [
    'billing-policy.test.mjs', 'billing-client-contract.test.mjs', 'billing-provider-contract.test.mjs',
    'pro-paywall-contract.test.mjs', 'pro-feature-gates.test.mjs', 'pro-more-screen.test.mjs',
    'pro-release-contract.test.mjs'
  ]) write(`scripts/${name}`, '// contract test\n');
  return { root, write };
};

test('accepts the approved Pro contract', () => {
  const { root } = makeRoot();
  assert.equal(validateProBilling(root), true);
});

test('rejects a hard-coded launch price and names the offending source file', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/app/(tabs)/more.tsx', 'Upgrade for $9.99');
  assert.throws(
    () => validateProBilling(root),
    (error) => /localized store price/i.test(error.message) && error.message.includes('apps/mobile/app/(tabs)/more.tsx'),
  );
});

test('rejects unconditional free-trial marketing without a store free-phase signal', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/app/pro.tsx', '<Text>7-day free trial for eligible new subscribers.</Text>');
  assert.throws(() => validateProBilling(root), /trial.*store.*free.?phase/i);
});

test('accepts trial copy when the paywall checks a returned store free phase', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/app/pro.tsx', `
    const hasStoreTrial = ordered.some(pkg => Boolean(pkg.product.defaultOption?.freePhase));
    const view = hasStoreTrial ? <Text>Free trial available through the store offer.</Text> : null;
  `);
  assert.equal(validateProBilling(root), true);
});

test('rejects RevenueCat entitlement drift', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/src/billing/entitlement-policy.ts', "export const PRO_ENTITLEMENT_ID = 'premium';\n");
  assert.throws(() => validateProBilling(root), /entitlement.*pro/i);
});
