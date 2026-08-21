import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLD_FALLBACK = '<Text style={s.copy}>Target offer: $9.99/month or $79.99/year. Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const NEW_FALLBACK = '<Text style={s.copy}>Your store-localized prices will appear here as soon as the Play/App Store products are connected.</Text>';
const OLD_TRIAL = '<Text style={s.trial}>7-day free trial when available for eligible new subscribers through the store offer.</Text>';
const NEW_TRIAL = "{ordered.some(pkg => Boolean(pkg.product.defaultOption?.freePhase) || Boolean(pkg.product.subscriptionOptions?.some(option => Boolean(option.freePhase)))) ? <Text style={s.trial}>Free trial available through the store offer shown above.</Text> : null}";

const must = (condition, message) => { if (!condition) throw new Error(message); };
const assertionSubject = (line) => line.match(/assert\.match\(\s*([^,]+)\s*,/)?.[1]?.trim() ?? null;
const isMonthlyPriceAssertion = (line) => line.includes('assert.match(') && line.includes('$9') && /month/i.test(line);
const isAnnualPriceAssertion = (line) => line.includes('assert.match(') && line.includes('$79') && /(year|annual)/i.test(line);
const isUnconditionalTrialAssertion = (line) => line.includes('assert.match(') && /trial/i.test(line) && !/freePhase/.test(line);
const isFixedPriceGuard = (line) => line.includes('assert.doesNotMatch(') && line.includes('$9') && line.includes('$79');
const isFreePhaseGuard = (line) => line.includes('assert.match(') && line.includes('freePhase');

function hardenPaywallContract(root) {
  const contract = path.join(root, 'scripts/pro-paywall-contract.test.mjs');
  if (!fs.existsSync(contract)) return;

  let lines = fs.readFileSync(contract, 'utf8').split('\n');
  const alreadyHardened = lines.some(isFixedPriceGuard) && lines.some(isFreePhaseGuard);

  if (!alreadyHardened) {
    const monthLine = lines.find(isMonthlyPriceAssertion);
    const yearLine = lines.find(isAnnualPriceAssertion);
    const trialLine = lines.find(isUnconditionalTrialAssertion);
    must(monthLine, 'Generated Pro paywall contract is missing the expected monthly-price assertion');
    must(yearLine, 'Generated Pro paywall contract is missing the expected annual-price assertion');
    must(trialLine, 'Generated Pro paywall contract is missing the expected trial assertion');

    const monthSubject = assertionSubject(monthLine);
    const trialSubject = assertionSubject(trialLine);
    must(monthSubject, 'Generated Pro paywall monthly-price assertion subject could not be parsed');
    must(trialSubject, 'Generated Pro paywall trial assertion subject could not be parsed');

    const next = [];
    for (const line of lines) {
      if (isMonthlyPriceAssertion(line)) {
        const indent = line.match(/^\s*/)?.[0] ?? '';
        next.push(`${indent}assert.doesNotMatch(${monthSubject}, /\\$9\\.99|\\$79\\.99/);`);
        continue;
      }
      if (isAnnualPriceAssertion(line)) continue;
      if (isUnconditionalTrialAssertion(line)) {
        const indent = line.match(/^\s*/)?.[0] ?? '';
        next.push(`${indent}assert.match(${trialSubject}, /freePhase/);`);
        continue;
      }
      next.push(line);
    }
    lines = next;
  }

  must(!lines.some(isMonthlyPriceAssertion), 'Generated Pro paywall contract still requires a fixed monthly price');
  must(!lines.some(isAnnualPriceAssertion), 'Generated Pro paywall contract still requires a fixed annual price');
  must(!lines.some(isUnconditionalTrialAssertion), 'Generated Pro paywall contract still requires unconditional trial copy');
  must(lines.some((line) => line.includes('priceString')), 'Generated Pro paywall contract must retain localized priceString coverage');
  must(lines.some(isFixedPriceGuard), 'Generated Pro paywall contract must forbid fixed launch prices');
  must(lines.some(isFreePhaseGuard), 'Generated Pro paywall contract must require store-backed freePhase coverage');

  fs.writeFileSync(contract, lines.join('\n'));
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
