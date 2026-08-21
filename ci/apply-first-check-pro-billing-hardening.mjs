import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLD_FALLBACK = '<Text style={s.copy}>Target offer: $9.99/month or $79.99/year. Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const NEW_FALLBACK = '<Text style={s.copy}>Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const OLD_TRIAL = '<Text style={s.trial}>7-day free trial when available for eligible new subscribers through the store offer.</Text>';
const NEW_TRIAL = "{ordered.some(pkg => Boolean(pkg.product.defaultOption?.freePhase) || Boolean(pkg.product.subscriptionOptions?.some(option => Boolean(option.freePhase)))) ? <Text style={s.trial}>Free trial available through the store offer shown above.</Text> : null}";
const OLD_CONTRACT_PRICE_MONTH = '  assert.match(screen, /\\$9\\.99\\/month/);';
const OLD_CONTRACT_PRICE_YEAR = '  assert.match(screen, /\\$79\\.99\\/year/);';
const OLD_CONTRACT_TRIAL = '  assert.match(screen, /7-day free trial/i);';
const NEW_CONTRACT_FIXED_PRICE = '  assert.doesNotMatch(screen, /\\$9\\.99|\\$79\\.99/);';
const NEW_CONTRACT_TRIAL = '  assert.match(screen, /freePhase/);';

const must = (condition, message) => { if (!condition) throw new Error(message); };

function hardenPaywallContract(root) {
  const contract = path.join(root, 'scripts/pro-paywall-contract.test.mjs');
  if (!fs.existsSync(contract)) return;

  let text = fs.readFileSync(contract, 'utf8');
  const alreadyHardened = text.includes(NEW_CONTRACT_FIXED_PRICE) && text.includes(NEW_CONTRACT_TRIAL);

  if (!alreadyHardened) {
    must(text.includes(OLD_CONTRACT_PRICE_MONTH), 'Generated Pro paywall contract is missing the expected monthly-price assertion');
    must(text.includes(OLD_CONTRACT_PRICE_YEAR), 'Generated Pro paywall contract is missing the expected annual-price assertion');
    must(text.includes(OLD_CONTRACT_TRIAL), 'Generated Pro paywall contract is missing the expected trial assertion');
    text = text.replace(OLD_CONTRACT_PRICE_MONTH, NEW_CONTRACT_FIXED_PRICE);
    text = text.replace(`${OLD_CONTRACT_PRICE_YEAR}\n`, '');
    text = text.replace(OLD_CONTRACT_TRIAL, NEW_CONTRACT_TRIAL);
  }

  must(!text.includes(OLD_CONTRACT_PRICE_MONTH), 'Generated Pro paywall contract still requires a fixed monthly price');
  must(!text.includes(OLD_CONTRACT_PRICE_YEAR), 'Generated Pro paywall contract still requires a fixed annual price');
  must(!text.includes(OLD_CONTRACT_TRIAL), 'Generated Pro paywall contract still requires unconditional trial copy');
  must(text.includes('priceString'), 'Generated Pro paywall contract must retain localized priceString coverage');
  must(text.includes(NEW_CONTRACT_FIXED_PRICE), 'Generated Pro paywall contract must forbid fixed launch prices');
  must(text.includes(NEW_CONTRACT_TRIAL), 'Generated Pro paywall contract must require store-backed freePhase coverage');

  fs.writeFileSync(contract, text);
}

export function applyProBillingHardening(root = 'build-src') {
  const file = path.join(root, 'apps/mobile/app/pro.tsx');
  must(fs.existsSync(file), `First Check Pro paywall not found: ${file}`);

  let text = fs.readFileSync(file, 'utf8');
  must(text.includes('pkg.product.priceString'), 'First Check Pro paywall must retain RevenueCat localized priceString');

  if (text.includes(OLD_FALLBACK)) text = text.replace(OLD_FALLBACK, NEW_FALLBACK);
  else must(text.includes(NEW_FALLBACK), 'First Check Pro fallback price copy does not match the approved source shape');

  if (text.includes(OLD_TRIAL)) text = text.replace(OLD_TRIAL, NEW_TRIAL);
  else must(text.includes(NEW_TRIAL), 'First Check Pro trial copy does not match the approved source shape');

  must(!/\$9\.99|\$79\.99/.test(text), 'First Check Pro paywall still contains a fixed launch price');
  must(text.includes('freePhase'), 'First Check Pro trial copy must be gated by returned store free-phase data');

  fs.writeFileSync(file, text);
  hardenPaywallContract(root);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  applyProBillingHardening(process.argv[2] ?? 'build-src');
  console.log('First Check Pro billing hardening applied: localized pricing + store-backed trial copy + hardened regression contract.');
}
