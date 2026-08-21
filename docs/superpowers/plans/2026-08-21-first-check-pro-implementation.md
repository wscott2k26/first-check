# First Check Pro 1.1 Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship First Check Pro 1.1 on Android with RevenueCat-backed monthly/annual subscriptions, a 7-day eligible-customer trial, exact-artifact runtime verification, and a signed Google Play release candidate while minimizing account-owner input.

**Architecture:** Keep the existing Pro billing, paywall, feature-gate, and clean-launch implementation intact unless a new conformance gate proves a real gap. Harden the release pipeline around that implementation: fingerprint the reconstructed source, trigger runtime smoke directly from the successful build run, create a signed EAS release from the exact verified source, smoke-test that exact signed AAB, and record one release-candidate receipt. External Google Play and RevenueCat setup remains a small explicit owner checkpoint; no private service credential is committed to the repository.

**Tech Stack:** Expo SDK 57, React Native, Expo Router, TypeScript, `react-native-purchases@10.5.0`, RevenueCat, Google Play Billing, pnpm 11.9.0, Node 24.19.0, Gradle/Android API 36, GitHub Actions, EAS Build, bundletool 1.18.1, Android emulator API 35/36.

**Spec:** `docs/superpowers/specs/2026-08-21-first-check-pro-design.md`

## Global Constraints

- App version remains exactly `1.1.0`.
- Android package remains exactly `com.stormandme.firstcheck`.
- Android `versionCode` remains exactly `4` for this release.
- iOS bundle identifier remains `com.stormandme.firstcheck`; iOS `buildNumber` remains `2`, but iOS submission is a later plan.
- `react-native-purchases` remains pinned to `10.5.0`.
- RevenueCat entitlement ID remains exactly `pro`.
- Google Play subscription ID is `firstcheck_pro`.
- Base plan IDs are `monthly` and `annual`.
- US launch prices are `$9.99/month` and `$79.99/year`.
- Each base plan receives a Google-determined new-customer offer ID `trial-7d` with a 7-day free trial for customers who have never had `firstcheck_pro`.
- App UI must use store/RevenueCat localized price strings rather than hard-coded `$9.99` or `$79.99` display strings.
- Trial language must appear only when the store returns a trial-capable subscription option for that customer.
- Free users retain the core First Check workflow.
- Pro unlocks Ask AI, full operational history, advanced reports/exports, and multiple environments.
- RevenueCat customer information and active entitlement state are the source of truth for Pro access.
- Billing/network failure must not crash, sign out, erase data, or block the free workflow.
- Existing signed-out `/sign-in` and signed-in `/today` clean-launch behavior is a hard regression gate.
- The unsigned AAB is a deterministic preflight artifact only. Only the exact signed AAB that passes signed runtime smoke and Google Play purchase/restore testing can be submitted.
- No RevenueCat secret key, Google service-account private key, keystore, or signing password may be committed.

## File Structure

The repository reconstructs the application into `build-src`, so release hardening belongs in focused CI scripts rather than rewriting the compressed source payload unless a conformance test exposes a real app defect.

**Create**
- `ci/assert-pro-billing-ready.mjs` — validates the reconstructed Pro billing/paywall contract without modifying app code.
- `ci/test-assert-pro-billing-ready.mjs` — fixture-driven tests for the conformance validator.
- `ci/release-input-fingerprint.sh` — produces one deterministic SHA-256 for the reconstructed release inputs.
- `ci/test_release_input_fingerprint.py` — verifies fingerprint stability and change detection.
- `ci/test-runtime-workflow-contract.mjs` — statically verifies that runtime smoke is chained to the actual successful build run.
- `.github/workflows/android-pro-signed-release.yml` — rebuilds the exact verified source with EAS signing and uploads the signed AAB + SHA receipt.
- `ci/test-signed-release-workflow-contract.mjs` — statically verifies signed-release safety requirements.
- `.github/workflows/android-pro-signed-runtime-smoke.yml` — smoke-tests the exact signed AAB on Android API 35 and 36.
- `ci/validate-pro-release-candidate.mjs` — validates the final machine-readable candidate receipt.
- `docs/store/first-check-pro-owner-checkpoint.md` — the only Google Play/RevenueCat configuration steps that require the account owner.
- `docs/store/first-check-pro-test-matrix.md` — end-to-end purchase/restore/expiration evidence checklist.

**Modify**
- `.github/workflows/android-store-public.yml` — run the conformance gate, create a source fingerprint, upload it, and record source provenance.
- `.github/workflows/android-pro-code4-runtime-smoke.yml` — replace receipt-commit push triggering with direct `workflow_run` triggering from `First Check Android Store Build` while keeping manual recovery dispatch.
- `ci/pro-code4-runtime-result.json` — CI-owned runtime receipt; fields expand to include source commit and fingerprint.

---

### Task 1: Freeze the Existing Pro Billing Contract Before Changing the Pipeline

**Files:**
- Create: `ci/assert-pro-billing-ready.mjs`
- Create: `ci/test-assert-pro-billing-ready.mjs`
- Modify: `.github/workflows/android-store-public.yml`
- Existing generated sources inspected by the validator: `build-src/apps/mobile/src/billing/**`, `build-src/apps/mobile/app/(tabs)/ask-ai.tsx`, `build-src/apps/mobile/app/(tabs)/history.tsx`, `build-src/apps/mobile/app/(tabs)/more.tsx`, `build-src/apps/mobile/app/workspace/index.tsx`
- Existing generated tests required by the validator: `build-src/scripts/billing-policy.test.mjs`, `build-src/scripts/billing-client-contract.test.mjs`, `build-src/scripts/billing-provider-contract.test.mjs`, `build-src/scripts/pro-paywall-contract.test.mjs`, `build-src/scripts/pro-feature-gates.test.mjs`, `build-src/scripts/pro-more-screen.test.mjs`, `build-src/scripts/pro-release-contract.test.mjs`

**Interfaces:**
- Consumes: reconstructed/applicator-modified source root passed as CLI argument, defaulting to `build-src`.
- Produces: `validateProBilling(root: string): true`; exits nonzero with a specific message on contract drift.

- [ ] **Step 1: Write the failing validator test**

Create `ci/test-assert-pro-billing-ready.mjs`:

```js
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
    const REVENUECAT_ANDROID_API_KEY = 'REVENUECAT_ANDROID_API_KEY';
    export async function loadBilling(){ return Purchases.getOfferings(); }
    export async function buy(pkg){ return Purchases.purchasePackage(pkg); }
    export async function restore(){ return Purchases.restorePurchases(); }
  `);
  write('apps/mobile/src/billing/billing-provider.tsx', 'const customerInfo = {};');
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

test('rejects a hard-coded launch price in app source', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/app/(tabs)/more.tsx', 'Upgrade for $9.99');
  assert.throws(() => validateProBilling(root), /localized store price/i);
});

test('rejects RevenueCat entitlement drift', () => {
  const { root, write } = makeRoot();
  write('apps/mobile/src/billing/entitlement-policy.ts', "export const PRO_ENTITLEMENT_ID = 'premium';\n");
  assert.throws(() => validateProBilling(root), /entitlement.*pro/i);
});
```

- [ ] **Step 2: Run the test and verify it fails because the validator does not exist**

Run:

```bash
node --test ci/test-assert-pro-billing-ready.mjs
```

Expected: FAIL with module-not-found for `ci/assert-pro-billing-ready.mjs`.

- [ ] **Step 3: Implement the minimal conformance validator**

Create `ci/assert-pro-billing-ready.mjs` with one exported `validateProBilling` function. It must:

```js
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
```

If the real reconstructed source uses `getOfferings()` behind a wrapper but the exact token is different, do not weaken the requirement silently: inspect `billing-client-contract.test.mjs`, update the validator to the wrapper's actual exported function, and add that exact function to the fixture test in the same commit.

- [ ] **Step 4: Run the validator unit tests**

Run:

```bash
node --test ci/test-assert-pro-billing-ready.mjs
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run it against the real reconstructed Pro source**

Run:

```bash
bash ci/RECONSTRUCT.sh
node ci/apply-premium-mobile-theme.mjs build-src
node ci/apply-expo-sdk57-compat.mjs build-src
node ci/apply-typescript-sdk57-compat.mjs build-src
node ci/apply-mobile-tsconfig-sdk57-compat.mjs build-src
node ci/apply-mobile-typescript-source-compat.mjs build-src
node ci/restore-workspace-config.mjs build-src
node ci/apply-store-v3-hardening.mjs build-src
node ci/apply-storm-brand-v4.mjs build-src
node ci/apply-first-check-pro.mjs build-src
node ci/apply-first-check-pro-code4.mjs build-src
node ci/assert-first-check-pro-code4.mjs build-src
node ci/assert-pro-billing-ready.mjs build-src
```

Expected: both Pro assertions print PASS. If the new validator exposes an actual implementation gap, stop this task, add a focused failing test to the existing generated billing contract, patch only that behavior in `ci/apply-first-check-pro.mjs` or a new focused applicator, then rerun all seven existing Pro tests plus this validator before continuing.

- [ ] **Step 6: Add the conformance gate to the store workflow**

In `.github/workflows/android-store-public.yml`, immediately after `Verify Pro code 4 + clean-launch contract`, add:

```yaml
      - name: Verify Pro billing + paywall contract
        run: node ci/assert-pro-billing-ready.mjs build-src
```

Also add `ci/assert-pro-billing-ready.mjs` to the workflow's push path filters.

- [ ] **Step 7: Run all existing Pro regression tests**

Run from `build-src`:

```bash
node --experimental-strip-types --test \
  scripts/billing-policy.test.mjs \
  scripts/billing-client-contract.test.mjs \
  scripts/billing-provider-contract.test.mjs \
  scripts/pro-paywall-contract.test.mjs \
  scripts/pro-feature-gates.test.mjs \
  scripts/pro-more-screen.test.mjs \
  scripts/pro-release-contract.test.mjs
```

Expected: PASS with no billing/paywall/feature-gate failures.

- [ ] **Step 8: Commit**

```bash
git add ci/assert-pro-billing-ready.mjs ci/test-assert-pro-billing-ready.mjs .github/workflows/android-store-public.yml
git commit -m "test: harden First Check Pro billing contract"
```

---

### Task 2: Fingerprint the Exact Reconstructed Release Inputs

**Files:**
- Create: `ci/release-input-fingerprint.sh`
- Create: `ci/test_release_input_fingerprint.py`
- Modify: `.github/workflows/android-store-public.yml`
- Modify: `ci/store-build-result.json` format written by CI

**Interfaces:**
- Consumes: one reconstructed source directory.
- Produces: one lowercase 64-character SHA-256 on stdout; store build receipt fields `source_head_sha` and `release_input_sha256`.

- [ ] **Step 1: Write the failing fingerprint test**

Create `ci/test_release_input_fingerprint.py`:

```python
import pathlib, subprocess, tempfile, unittest

SCRIPT = pathlib.Path(__file__).with_name('release-input-fingerprint.sh')

class FingerprintTest(unittest.TestCase):
    def fingerprint(self, root):
        return subprocess.check_output(['bash', str(SCRIPT), str(root)], text=True).strip()

    def test_same_files_produce_same_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            (root / 'apps').mkdir(); (root / 'apps' / 'a.ts').write_text('alpha\n')
            (root / 'package.json').write_text('{}\n')
            self.assertEqual(self.fingerprint(root), self.fingerprint(root))

    def test_content_change_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            (root / 'apps').mkdir(); f = root / 'apps' / 'a.ts'; f.write_text('alpha\n')
            before = self.fingerprint(root)
            f.write_text('beta\n')
            self.assertNotEqual(before, self.fingerprint(root))

if __name__ == '__main__': unittest.main()
```

- [ ] **Step 2: Run it and verify failure**

Run:

```bash
python3 ci/test_release_input_fingerprint.py
```

Expected: FAIL because `ci/release-input-fingerprint.sh` does not exist.

- [ ] **Step 3: Implement deterministic fingerprinting**

Create `ci/release-input-fingerprint.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?reconstructed source root required}"
cd "$ROOT"
find apps packages scripts \
  -type f \
  ! -path '*/node_modules/*' \
  ! -path '*/android/*' \
  ! -path '*/ios/*' \
  -print0 \
| LC_ALL=C sort -z \
| xargs -0 sha256sum \
| sha256sum \
| awk '{print $1}'
```

The prebuild-generated `android/` and `ios/` trees are intentionally excluded; the fingerprint represents the source/config that EAS and Gradle consume before native generation.

- [ ] **Step 4: Run fingerprint tests**

Run:

```bash
python3 ci/test_release_input_fingerprint.py
```

Expected: 2 tests PASS.

- [ ] **Step 5: Record and upload the fingerprint in the unsigned store build**

In `.github/workflows/android-store-public.yml`, after the Pro contract tests and before dependency installation, add:

```yaml
      - name: Fingerprint exact release inputs
        working-directory: build-src
        run: |
          bash ../ci/release-input-fingerprint.sh . | tee /tmp/first-check-pro-v1.1-code4-source.sha256
          test "$(wc -c < /tmp/first-check-pro-v1.1-code4-source.sha256)" -eq 65
```

Include that file in the existing unsigned AAB artifact upload. Extend `ci/store-build-result.json` to write:

```json
{
  "status": "success",
  "run_id": 0,
  "source_head_sha": "40-character git sha",
  "release_input_sha256": "64-character sha256",
  "release": "1.1.0",
  "version_code": 4,
  "ios_build": "2",
  "unsigned_aab_sha256": "64-character sha256"
}
```

Use `${{ github.sha }}` for `source_head_sha` and the file value for `release_input_sha256`; do not insert literal example values.

- [ ] **Step 6: Commit**

```bash
git add ci/release-input-fingerprint.sh ci/test_release_input_fingerprint.py .github/workflows/android-store-public.yml
git commit -m "ci: fingerprint Pro release inputs"
```

---

### Task 3: Chain Runtime Smoke Directly to the Successful Unsigned Build Run

**Files:**
- Create: `ci/test-runtime-workflow-contract.mjs`
- Modify: `.github/workflows/android-pro-code4-runtime-smoke.yml`
- Existing runtime executor: `ci/run-pro-code4-smoke-stable.sh`

**Interfaces:**
- Consumes: GitHub `workflow_run` event for `First Check Android Store Build`, or manual `source_run` recovery input.
- Produces: `ci/pro-code4-runtime-result.json` containing the actual source run, source head SHA, source fingerprint, AAB SHA, API levels, five cold launches per API, and final runtime status.

- [ ] **Step 1: Write a failing static workflow contract test**

Create `ci/test-runtime-workflow-contract.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/android-pro-code4-runtime-smoke.yml', 'utf8');

test('runtime smoke is triggered by the completed store workflow', () => {
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /First Check Android Store Build/);
  assert.match(workflow, /types:\s*\[completed\]/);
});

test('runtime smoke does not depend on a GITHUB_TOKEN receipt push', () => {
  assert.doesNotMatch(workflow, /paths:[\s\S]*ci\/store-build-result\.json/);
  assert.match(workflow, /github\.event\.workflow_run\.id/);
});

test('manual recovery names the exact source run', () => {
  assert.match(workflow, /source_run:/);
  assert.match(workflow, /workflow_dispatch:/);
});
```

- [ ] **Step 2: Run and confirm the old workflow fails the new contract**

Run:

```bash
node --test ci/test-runtime-workflow-contract.mjs
```

Expected: FAIL because the current workflow is still push-triggered from `ci/store-build-result.json`.

- [ ] **Step 3: Replace the trigger with direct workflow chaining**

Change the top of `.github/workflows/android-pro-code4-runtime-smoke.yml` to:

```yaml
name: First Check Pro 1.1 Code 4 Runtime Smoke

on:
  workflow_run:
    workflows: ["First Check Android Store Build"]
    types: [completed]
  workflow_dispatch:
    inputs:
      source_run:
        description: "Successful First Check Android Store Build run ID"
        required: true
        type: string
```

In `preflight`, derive the exact run instead of reading the latest receipt commit:

```bash
if test '${{ github.event_name }}' = workflow_run; then
  RUN='${{ github.event.workflow_run.id }}'
  STATUS='${{ github.event.workflow_run.conclusion }}'
  HEAD_SHA='${{ github.event.workflow_run.head_sha }}'
else
  RUN='${{ inputs.source_run }}'
  STATUS="$(gh run view "$RUN" --repo '${{ github.repository }}' --json conclusion -q .conclusion)"
  HEAD_SHA="$(gh run view "$RUN" --repo '${{ github.repository }}' --json headSha -q .headSha)"
fi

test "$STATUS" = success
mkdir -p /tmp/pro-code4-preflight
gh run download "$RUN" --repo '${{ github.repository }}' \
  -n first-check-pro-v1.1-code4-unsigned-store-aab \
  -D /tmp/pro-code4-preflight
AAB=/tmp/pro-code4-preflight/first-check-pro-v1.1-code4-unsigned-release.aab
EXPECTED_SHA="$(cut -d' ' -f1 /tmp/pro-code4-preflight/first-check-pro-v1.1-code4-unsigned-release.sha256)"
SOURCE_FINGERPRINT="$(tr -d '\r\n ' < /tmp/pro-code4-preflight/first-check-pro-v1.1-code4-source.sha256)"
ACTUAL_SHA="$(sha256sum "$AAB" | awk '{print $1}')"
test "$ACTUAL_SHA" = "$EXPECTED_SHA"
echo "source_run=$RUN" >> "$GITHUB_OUTPUT"
echo "source_head_sha=$HEAD_SHA" >> "$GITHUB_OUTPUT"
echo "aab_sha=$ACTUAL_SHA" >> "$GITHUB_OUTPUT"
echo "release_input_sha=$SOURCE_FINGERPRINT" >> "$GITHUB_OUTPUT"
```

Expose all four outputs and keep the existing API `[35, 36]` matrix and `ci/run-pro-code4-smoke-stable.sh` unchanged.

- [ ] **Step 4: Expand the runtime receipt**

The `gate` job must write:

```json
{
  "status": "success",
  "run_id": 0,
  "source_run": 0,
  "source_head_sha": "40-character git sha",
  "release_input_sha256": "64-character sha256",
  "release": "1.1.0",
  "version_code": 4,
  "runtime": "success",
  "apis": [35, 36],
  "cold_launches_per_api": 5,
  "unsigned_aab_sha256": "64-character sha256"
}
```

The workflow fills the dynamic values from `needs.preflight.outputs`; the JSON above defines the schema only.

- [ ] **Step 5: Run static workflow tests**

Run:

```bash
node --test ci/test-runtime-workflow-contract.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add ci/test-runtime-workflow-contract.mjs .github/workflows/android-pro-code4-runtime-smoke.yml
git commit -m "ci: chain Pro runtime to exact store build"
```

---

### Task 4: Build the Signed Pro AAB From the Exact Verified Source

**Files:**
- Create: `.github/workflows/android-pro-signed-release.yml`
- Create: `ci/test-signed-release-workflow-contract.mjs`
- Reuse: `ci/release-input-fingerprint.sh`, `ci/assert-pro-billing-ready.mjs`, all existing Pro tests

**Interfaces:**
- Consumes: manual `source_run` referring to a successful unsigned store build whose `ci/pro-code4-runtime-result.json` is green.
- Requires GitHub/EAS runtime configuration: `EXPO_TOKEN` and the public RevenueCat Android SDK key exposed to the build as `REVENUECAT_ANDROID_API_KEY` without committing the value.
- Produces: GitHub artifact `first-check-pro-v1.1-code4-signed-aab` containing `first-check-pro-v1.1-code4-signed.aab`, `first-check-pro-v1.1-code4-signed.sha256`, `first-check-pro-v1.1-code4-source.sha256`, and `signed-build-metadata.json`.

- [ ] **Step 1: Write a failing signed-workflow contract test**

Create `ci/test-signed-release-workflow-contract.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const path = '.github/workflows/android-pro-signed-release.yml';

test('signed workflow exists and requires exact source run', () => {
  assert.equal(fs.existsSync(path), true);
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /source_run:/);
  assert.match(yml, /ci\/pro-code4-runtime-result\.json/);
  assert.match(yml, /release-input-fingerprint\.sh/);
});

test('signed workflow uses EAS credentials without committing them', () => {
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /secrets\.EXPO_TOKEN/);
  assert.match(yml, /REVENUECAT_ANDROID_API_KEY/);
  assert.match(yml, /eas build/);
  assert.match(yml, /--platform android/);
  assert.match(yml, /--profile production/);
  assert.match(yml, /--non-interactive/);
});

test('signed workflow uploads a hash next to the AAB', () => {
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /first-check-pro-v1\.1-code4-signed\.sha256/);
  assert.match(yml, /first-check-pro-v1\.1-code4-signed-aab/);
});
```

- [ ] **Step 2: Run it and verify failure**

Run:

```bash
node --test ci/test-signed-release-workflow-contract.mjs
```

Expected: FAIL because `.github/workflows/android-pro-signed-release.yml` does not exist.

- [ ] **Step 3: Create the signed workflow with an exact-source preflight**

Create `.github/workflows/android-pro-signed-release.yml` with `workflow_dispatch.inputs.source_run`. Its first checkout is `main` so it can read the latest runtime receipt. Fail unless all of these are true:

```bash
RECEIPT=ci/pro-code4-runtime-result.json
test "$(node -p "JSON.parse(require('fs').readFileSync('$RECEIPT','utf8')).status")" = success
test "$(node -p "JSON.parse(require('fs').readFileSync('$RECEIPT','utf8')).source_run")" = '${{ inputs.source_run }}'
EXPECTED_SOURCE_SHA="$(node -p "JSON.parse(require('fs').readFileSync('$RECEIPT','utf8')).source_head_sha")"
EXPECTED_INPUT_SHA="$(node -p "JSON.parse(require('fs').readFileSync('$RECEIPT','utf8')).release_input_sha256")"
```

Resolve the same source run from GitHub and prove it matches:

```bash
ACTUAL_SOURCE_SHA="$(gh run view '${{ inputs.source_run }}' --repo '${{ github.repository }}' --json headSha -q .headSha)"
test "$ACTUAL_SOURCE_SHA" = "$EXPECTED_SOURCE_SHA"
echo "SOURCE_SHA=$ACTUAL_SOURCE_SHA" >> "$GITHUB_ENV"
echo "EXPECTED_INPUT_SHA=$EXPECTED_INPUT_SHA" >> "$GITHUB_ENV"
```

Then check out `$SOURCE_SHA`, reconstruct source, apply the same applicators in the same order as `.github/workflows/android-store-public.yml`, run `ci/assert-first-check-pro-code4.mjs`, `ci/assert-pro-billing-ready.mjs`, and the seven Pro regression tests.

- [ ] **Step 4: Prove the signed build input matches the preflight build input**

Before EAS upload:

```bash
ACTUAL_INPUT_SHA="$(bash ci/release-input-fingerprint.sh build-src)"
echo "$ACTUAL_INPUT_SHA" | tee /tmp/first-check-pro-v1.1-code4-source.sha256
test "$ACTUAL_INPUT_SHA" = "$EXPECTED_INPUT_SHA"
```

Expected: exact match. A mismatch stops signing.

- [ ] **Step 5: Fail fast if account-owned build values are absent**

The workflow environment must expose:

```yaml
env:
  EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
  REVENUECAT_ANDROID_API_KEY: ${{ secrets.REVENUECAT_ANDROID_API_KEY }}
```

Before EAS build:

```bash
test -n "$EXPO_TOKEN" || { echo 'EXPO_TOKEN is missing'; exit 41; }
test -n "$REVENUECAT_ANDROID_API_KEY" || { echo 'REVENUECAT_ANDROID_API_KEY is missing'; exit 42; }
```

`REVENUECAT_ANDROID_API_KEY` is a public mobile SDK key, but keeping it in GitHub/EAS configuration prevents repository churn and ensures the release build is intentionally configured.

- [ ] **Step 6: Build with EAS and download the signed AAB**

Run from `build-src/apps/mobile`. Use the repository's configured `production` EAS profile; if that profile is absent, stop and add the minimal Android production profile before retrying rather than silently using a development profile.

```bash
pnpm dlx eas-cli build \
  --platform android \
  --profile production \
  --non-interactive \
  --wait \
  --json > /tmp/eas-build.json

BUILD_URL="$(node -p "const x=require('/tmp/eas-build.json'); const b=Array.isArray(x)?x[0]:x; b.artifacts?.buildUrl || b.artifacts?.applicationArchiveUrl || ''")"
BUILD_ID="$(node -p "const x=require('/tmp/eas-build.json'); const b=Array.isArray(x)?x[0]:x; b.id || ''")"
test -n "$BUILD_ID"
test -n "$BUILD_URL"
curl -fL "$BUILD_URL" -o /tmp/first-check-pro-v1.1-code4-signed.aab
test -s /tmp/first-check-pro-v1.1-code4-signed.aab
sha256sum /tmp/first-check-pro-v1.1-code4-signed.aab | tee /tmp/first-check-pro-v1.1-code4-signed.sha256
```

- [ ] **Step 7: Record signed build metadata and upload the artifact**

Write `/tmp/signed-build-metadata.json` with:

```json
{
  "release": "1.1.0",
  "version_code": 4,
  "package": "com.stormandme.firstcheck",
  "source_run": 0,
  "source_head_sha": "40-character git sha",
  "release_input_sha256": "64-character sha256",
  "eas_build_id": "EAS build identifier",
  "signed_aab_sha256": "64-character sha256"
}
```

Populate the dynamic values from environment/output, then upload all four files under artifact name `first-check-pro-v1.1-code4-signed-aab` with retention at least 14 days.

- [ ] **Step 8: Run static signed-workflow tests**

Run:

```bash
node --test ci/test-signed-release-workflow-contract.mjs
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/android-pro-signed-release.yml ci/test-signed-release-workflow-contract.mjs
git commit -m "ci: add exact-source signed Pro build"
```

---

### Task 5: Smoke-Test the Exact Signed AAB and Create the Release Candidate Receipt

**Files:**
- Create: `.github/workflows/android-pro-signed-runtime-smoke.yml`
- Create: `ci/validate-pro-release-candidate.mjs`
- Reuse: `ci/run-pro-code4-smoke-stable.sh`
- Create/CI-write: `ci/pro-release-candidate.json`

**Interfaces:**
- Consumes: successful `First Check Pro 1.1 Signed Release` workflow run.
- Produces: signed-AAB runtime evidence on API 35/36 and `ci/pro-release-candidate.json` with `purchase_test_status: "pending"` until the Google Play test lifecycle is proven.

- [ ] **Step 1: Write the candidate validator first**

Create `ci/validate-pro-release-candidate.mjs`:

```js
import fs from 'node:fs';

const file = process.argv[2] ?? 'ci/pro-release-candidate.json';
const x = JSON.parse(fs.readFileSync(file, 'utf8'));
const must = (c, m) => { if (!c) throw new Error(m); };

must(x.release === '1.1.0', 'release must be 1.1.0');
must(x.version_code === 4, 'version_code must be 4');
must(x.package === 'com.stormandme.firstcheck', 'package drifted');
must(/^[0-9a-f]{40}$/.test(x.source_head_sha), 'source_head_sha invalid');
must(/^[0-9a-f]{64}$/.test(x.release_input_sha256), 'release_input_sha256 invalid');
must(/^[0-9a-f]{64}$/.test(x.signed_aab_sha256), 'signed_aab_sha256 invalid');
must(x.signed_runtime_status === 'success', 'signed runtime must pass');
must(Array.isArray(x.apis) && x.apis.join(',') === '35,36', 'API smoke matrix must be 35,36');
must(x.cold_launches_per_api === 5, 'five cold launches per API required');
must(['pending', 'success'].includes(x.purchase_test_status), 'purchase test status invalid');

if (process.argv.includes('--submission-ready')) {
  must(x.purchase_test_status === 'success', 'Google Play purchase/restore test is not green');
}
console.log(`PASS: Pro candidate ${x.signed_aab_sha256} status=${x.purchase_test_status}`);
```

- [ ] **Step 2: Add a failing workflow existence/contract test to the existing signed workflow test file**

Append to `ci/test-signed-release-workflow-contract.mjs`:

```js
test('signed runtime workflow tests the signed artifact on API 35 and 36', () => {
  const p = '.github/workflows/android-pro-signed-runtime-smoke.yml';
  assert.equal(fs.existsSync(p), true);
  const yml = fs.readFileSync(p, 'utf8');
  assert.match(yml, /First Check Pro 1\.1 Signed Release/);
  assert.match(yml, /api:\s*\[35, 36\]/);
  assert.match(yml, /run-pro-code4-smoke-stable\.sh/);
  assert.match(yml, /first-check-pro-v1\.1-code4-signed-aab/);
  assert.match(yml, /pro-release-candidate\.json/);
});
```

Run:

```bash
node --test ci/test-signed-release-workflow-contract.mjs
```

Expected: FAIL because signed runtime workflow does not exist.

- [ ] **Step 3: Create direct signed-runtime chaining**

`.github/workflows/android-pro-signed-runtime-smoke.yml` starts with:

```yaml
name: First Check Pro 1.1 Signed Runtime Smoke

on:
  workflow_run:
    workflows: ["First Check Pro 1.1 Signed Release"]
    types: [completed]
  workflow_dispatch:
    inputs:
      signed_run:
        description: "Successful signed-release workflow run ID"
        required: true
        type: string
```

Preflight rejects any non-success source workflow, downloads `first-check-pro-v1.1-code4-signed-aab`, verifies `first-check-pro-v1.1-code4-signed.aab` against its `.sha256`, and parses `signed-build-metadata.json`.

- [ ] **Step 4: Reuse the stable cold-launch executor on the exact signed AAB**

For each API `[35, 36]`, run the same bundletool conversion and `ci/run-pro-code4-smoke-stable.sh` used by the unsigned gate. Before conversion, verify the AAB hash again in each matrix job. Do not rebuild the AAB in this workflow.

Expected per API: five cold launches, no crash/ANR/fatal signatures, no Expo Router unmatched route, branded First Check sign-in visible.

- [ ] **Step 5: Record the exact signed candidate**

The gate job writes `ci/pro-release-candidate.json`:

```json
{
  "release": "1.1.0",
  "version_code": 4,
  "package": "com.stormandme.firstcheck",
  "source_run": 0,
  "signed_run": 0,
  "source_head_sha": "40-character git sha",
  "release_input_sha256": "64-character sha256",
  "signed_aab_sha256": "64-character sha256",
  "signed_runtime_status": "success",
  "apis": [35, 36],
  "cold_launches_per_api": 5,
  "purchase_test_status": "pending"
}
```

Then run:

```bash
node ci/validate-pro-release-candidate.mjs ci/pro-release-candidate.json
```

Expected: PASS while `purchase_test_status` is pending; `--submission-ready` must still FAIL.

- [ ] **Step 6: Run workflow contract tests and commit**

```bash
node --test ci/test-signed-release-workflow-contract.mjs
git add .github/workflows/android-pro-signed-runtime-smoke.yml ci/validate-pro-release-candidate.mjs ci/test-signed-release-workflow-contract.mjs
git commit -m "ci: smoke-test exact signed Pro candidate"
```

---

### Task 6: Create the One Owner Checkpoint for Google Play and RevenueCat

**Files:**
- Create: `docs/store/first-check-pro-owner-checkpoint.md`
- Create: `docs/store/first-check-pro-test-matrix.md`

**Interfaces:**
- Consumes: approved pricing/product model from the spec.
- Produces: exact external configuration values and a screenshot/evidence checklist; no secrets are written to docs.

- [ ] **Step 1: Write the Google Play section with exact immutable identifiers**

`docs/store/first-check-pro-owner-checkpoint.md` must say:

```markdown
## Google Play

Subscription: `firstcheck_pro`

Base plan 1:
- ID: `monthly`
- Type: Auto-renewing
- Billing period: Monthly
- US price: $9.99

Offer under `monthly`:
- ID: `trial-7d`
- Eligibility: New customer acquisition → Never had this subscription
- Phase: Free trial → 7 days

Base plan 2:
- ID: `annual`
- Type: Auto-renewing
- Billing period: Yearly
- US price: $79.99

Offer under `annual`:
- ID: `trial-7d`
- Eligibility: New customer acquisition → Never had this subscription
- Phase: Free trial → 7 days
```

Note in the doc that Google requires offer IDs to be unique within each base plan, so `trial-7d` may be used once under `monthly` and once under `annual`. Do not rename an activated product/base-plan/offer ID casually because those identifiers are durable store contracts.

- [ ] **Step 2: Write the RevenueCat section**

Include:

```markdown
## RevenueCat

Android products:
- `firstcheck_pro:monthly`
- `firstcheck_pro:annual`

Entitlement:
- `pro`

Offering:
- Current/default offering contains one Monthly package mapped to `firstcheck_pro:monthly`
- Current/default offering contains one Annual package mapped to `firstcheck_pro:annual`

Build configuration:
- Copy the RevenueCat public Android SDK key only into the configured build environment value `REVENUECAT_ANDROID_API_KEY`.
- Never place a RevenueCat secret API key in the mobile app or repository.
```

- [ ] **Step 3: Keep the user interaction checkpoint intentionally tiny**

The owner doc ends with exactly four evidence requests:

```markdown
Send/record only these four confirmations:
1. Screenshot: Google Play `firstcheck_pro` page showing `monthly`, `annual`, and both `trial-7d` offers.
2. Screenshot: RevenueCat `pro` entitlement with monthly + annual products attached.
3. Screenshot: RevenueCat current offering showing Monthly + Annual packages.
4. Confirmation: public Android SDK key has been added to the build environment as `REVENUECAT_ANDROID_API_KEY` (do not paste the secret/server keys into chat or docs).
```

- [ ] **Step 4: Create the end-to-end store test matrix**

`docs/store/first-check-pro-test-matrix.md` contains:

```markdown
# First Check Pro Google Play Test Matrix

- [ ] License tester installs the Play-distributed test-track build, not a sideloaded APK.
- [ ] Free user can complete the core First Check workflow.
- [ ] Monthly package displays the Google/RevenueCat localized price.
- [ ] Annual package displays the Google/RevenueCat localized price and best-value emphasis.
- [ ] Eligible new tester sees the 7-day trial terms returned by the store.
- [ ] Purchase activates RevenueCat entitlement `pro`.
- [ ] Ask AI unlocks after entitlement refresh.
- [ ] Full history unlocks after entitlement refresh.
- [ ] Advanced reports/exports unlock after entitlement refresh.
- [ ] Multiple environments unlock after entitlement refresh.
- [ ] Force-close/reopen preserves Pro from RevenueCat customer info.
- [ ] Restore Purchases restores Pro after reinstall/session recovery.
- [ ] User-cancelled purchase leaves Free usable and does not show a crash/fatal error.
- [ ] A tester without an eligible offer is not promised a 7-day trial in-app.
- [ ] Expired/revoked test entitlement returns Pro gates to Free behavior without deleting operational data.
- [ ] Signed AAB SHA-256 being tested equals `ci/pro-release-candidate.json.signed_aab_sha256`.
```

- [ ] **Step 5: Verify docs contain no credential material and commit**

Run:

```bash
! grep -R -nE 'sk_[A-Za-z0-9]|BEGIN PRIVATE KEY|service_account|private_key' docs/store/first-check-pro-*.md
git add docs/store/first-check-pro-owner-checkpoint.md docs/store/first-check-pro-test-matrix.md
git commit -m "docs: add First Check Pro owner checkpoint"
```

Expected: grep exits 0 because no sensitive credential patterns are found.

---

### Task 7: Execute Google Play Test Purchase, Mark the Candidate Green, and Gate Submission

**Files:**
- Modify/CI-update: `ci/pro-release-candidate.json`
- Validate: `ci/validate-pro-release-candidate.mjs`
- Evidence reference: `docs/store/first-check-pro-test-matrix.md`

**Interfaces:**
- Consumes: exact signed candidate SHA plus Google Play license-tester purchase/restore evidence.
- Produces: `purchase_test_status: "success"` on the same signed candidate and a submission-ready validation pass.

- [ ] **Step 1: Upload the exact signed candidate to a non-production Play test track**

Use the AAB whose SHA matches `ci/pro-release-candidate.json.signed_aab_sha256`. After upload, use Play Console's artifact details to confirm version `1.1.0`, code `4`, package `com.stormandme.firstcheck`.

Do not generate a fresh AAB for this step.

- [ ] **Step 2: Run the full store test matrix**

Complete every item in `docs/store/first-check-pro-test-matrix.md` using a Google Play license tester/test-track install and RevenueCat dashboard/customer state.

Expected: purchase activates `pro`; restore reactivates `pro`; Free remains usable on cancellation/error; all four Pro gates agree.

- [ ] **Step 3: Update only the purchase-test status on the already-hashed candidate**

After every matrix item passes, change:

```json
"purchase_test_status": "pending"
```

to:

```json
"purchase_test_status": "success"
```

Do not change `source_head_sha`, `release_input_sha256`, or `signed_aab_sha256` during this status update.

- [ ] **Step 4: Run the submission-ready validator**

Run:

```bash
node ci/validate-pro-release-candidate.mjs ci/pro-release-candidate.json --submission-ready
```

Expected: PASS.

- [ ] **Step 5: Re-run final static/regression gates before Production**

Run:

```bash
node --test ci/test-assert-pro-billing-ready.mjs
node --test ci/test-runtime-workflow-contract.mjs
node --test ci/test-signed-release-workflow-contract.mjs
python3 ci/test_release_input_fingerprint.py
node ci/validate-pro-release-candidate.mjs ci/pro-release-candidate.json --submission-ready
```

Expected: all PASS.

- [ ] **Step 6: Commit the verified release receipt**

```bash
git add ci/pro-release-candidate.json docs/store/first-check-pro-test-matrix.md
git commit -m "release: verify First Check Pro 1.1 candidate"
```

- [ ] **Step 7: Submit only the verified code-4 AAB to Production**

Upload/promote the exact signed AAB whose SHA is in the green candidate receipt. Do not rebuild between test-track verification and production submission. After Google accepts the production update, the Android Pro 1.1 work is complete and iOS receives its own implementation/release plan.

---

## Final Verification Sequence

Before calling First Check Pro 1.1 Android release-ready, the executor must have evidence for this exact chain:

```text
approved spec
  -> reconstructed source
  -> Pro conformance gate
  -> release-input SHA-256
  -> unsigned code-4 AAB
  -> unsigned runtime API 35 + 36, 5 cold launches each
  -> same release-input SHA-256
  -> EAS signed code-4 AAB
  -> signed AAB SHA-256
  -> signed runtime API 35 + 36, 5 cold launches each
  -> Google Play test-track purchase + restore + entitlement lifecycle
  -> submission-ready candidate receipt
  -> Production submission of the same signed AAB
```

Any new source change after the release-input fingerprint invalidates downstream runtime/store-test evidence and restarts the chain from the unsigned build.

## Plan Self-Review

- Spec coverage: pricing, trial, one `pro` entitlement, Free/Pro boundaries, restore, customer-info source of truth, billing failure safety, clean launch, exact artifact testing, store purchase test, and low-input owner checkpoint are covered.
- Scope: Android Pro 1.1 only. iOS subscription products/TestFlight and Windows distribution remain separate follow-up plans.
- Placeholder scan: no TBD/TODO/fill-later instructions are used; dynamic hashes/run IDs are explicitly produced by workflows rather than represented as developer placeholders.
- Type/name consistency: `source_run`, `source_head_sha`, `release_input_sha256`, `signed_aab_sha256`, `purchase_test_status`, entitlement `pro`, product `firstcheck_pro`, base plans `monthly`/`annual`, and offer `trial-7d` are consistent across tasks.
