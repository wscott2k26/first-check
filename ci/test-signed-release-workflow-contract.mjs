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
