import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyProBillingHardening } from './apply-first-check-pro-billing-hardening.mjs';

const oldFallback = `<Text style={s.copy}>Target offer: $9.99/month or $79.99/year. Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>`;
const oldTrial = `<Text style={s.trial}>7-day free trial when available for eligible new subscribers through the store offer.</Text>`;

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-check-pro-hardening-'));
  const file = path.join(root, 'apps/mobile/app/pro.tsx');
  const contract = path.join(root, 'scripts/pro-paywall-contract.test.mjs');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.dirname(contract), { recursive: true });
  fs.writeFileSync(file, `
    {ordered.length ? ordered.map(pkg => <Pressable key={pkg.identifier}>
      <Text style={s.price}>{pkg.product.priceString}</Text>
    </Pressable>) : <View style={s.panel}>${oldFallback}</View>}
    ${oldTrial}
  `);
  fs.writeFileSync(contract, `
import assert from 'node:assert/strict';
import test from 'node:test';
const screen = 'fixture';
test('Pro paywall has approved offer, localized store prices, restore and legal links', () => {
  assert.match(screen, /\\$9\\.99\\/month/);
  assert.match(screen, /\\$79\\.99\\/year/);
  assert.match(screen, /7-day free trial/i);
  assert.match(screen, /priceString/);
  assert.match(screen, /Restore Purchases/);
});
  `);
  return { root, file, contract };
}

test('removes fixed launch prices and keeps RevenueCat localized priceString', () => {
  const { root, file } = makeRoot();
  applyProBillingHardening(root);
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /\$9\.99|\$79\.99/);
  assert.match(text, /pkg\.product\.priceString/);
  assert.match(text, /store-localized prices will appear here/i);
});

test('shows free-trial copy only when returned subscription options contain a free phase', () => {
  const { root, file } = makeRoot();
  applyProBillingHardening(root);
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /7-day free trial when available/);
  assert.match(text, /defaultOption\?\.freePhase/);
  assert.match(text, /subscriptionOptions\?\.some\(option => Boolean\(option\.freePhase\)\)/);
  assert.match(text, /Free trial available through the store offer shown above/);
});

test('updates the generated paywall regression contract to forbid fixed prices and require store-backed trial data', () => {
  const { root, contract } = makeRoot();
  applyProBillingHardening(root);
  const text = fs.readFileSync(contract, 'utf8');
  assert.doesNotMatch(text, /assert\.match\([^\n]+\\\$9\\\.99/);
  assert.doesNotMatch(text, /assert\.match\([^\n]+\\\$79\\\.99/);
  assert.doesNotMatch(text, /assert\.match\([^\n]+7-day free trial/);
  assert.match(text, /assert\.doesNotMatch\([^\n]+\\\$9\\\.99\|\\\$79\\\.99/);
  assert.match(text, /assert\.match\([^\n]+freePhase/);
  assert.match(text, /assert\.match\([^\n]+priceString/);
});

test('hardening is idempotent', () => {
  const { root, file, contract } = makeRoot();
  applyProBillingHardening(root);
  const onceFile = fs.readFileSync(file, 'utf8');
  const onceContract = fs.readFileSync(contract, 'utf8');
  applyProBillingHardening(root);
  assert.equal(fs.readFileSync(file, 'utf8'), onceFile);
  assert.equal(fs.readFileSync(contract, 'utf8'), onceContract);
});
