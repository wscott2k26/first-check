import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLD_FALLBACK = '<Text style={s.copy}>Target offer: $9.99/month or $79.99/year. Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const NEW_FALLBACK = '<Text style={s.copy}>Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const OLD_TRIAL = '<Text style={s.trial}>7-day free trial when available for eligible new subscribers through the store offer.</Text>';
const NEW_TRIAL = "{ordered.some(pkg => Boolean(pkg.product.defaultOption?.freePhase) || Boolean(pkg.product.subscriptionOptions?.some(option => Boolean(option.freePhase)))) ? <Text style={s.trial}>Free trial available through the store offer shown above.</Text> : null}";

const must = (condition, message) => { if (!condition) throw new Error(message); };

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
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  applyProBillingHardening(process.argv[2] ?? 'build-src');
  console.log('First Check Pro billing hardening applied: localized pricing + store-backed trial copy.');
}
