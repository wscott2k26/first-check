import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const path = '.github/workflows/android-pro-signed-release.yml';

const expectedCert = 'BB:4C:38:0F:06:70:60:09:D4:6D:6D:5C:2D:82:26:FA:57:49:8A:C6:4F:0C:8D:6C:45:62:BE:08:F0:4B:4E:37';
const expectedKeystoreSha = '69c6c1297977f0df1e47f7d80690476dff55c13318ab9c39282f27f45fd5c72e';

test('signed workflow exists and signs the exact runtime-tested unsigned run', () => {
  assert.equal(fs.existsSync(path), true);
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /source_run:/);
  assert.match(yml, /ci\/pro-code4-runtime-result\.json/);
  assert.match(yml, /first-check-pro-v1\.1-code4-unsigned-store-aab/);
  assert.match(yml, /release_input_sha256/);
  assert.doesNotMatch(yml, /eas build|gradlew|bundleRelease/);
});

test('signed workflow requires encrypted private signing material and exact certificate parity', () => {
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /FIRST_CHECK_SIGNING_BUNDLE_KEY_HEX/);
  assert.match(yml, /first-check-upload-signing\.enc\.b64/);
  assert.ok(yml.includes(expectedKeystoreSha), 'registered keystore SHA-256 must be pinned');
  assert.ok(yml.includes(expectedCert), 'Google Play code-3 upload certificate must be pinned');
  assert.match(yml, /firstcheck-upload/);
  assert.match(yml, /jarsigner/);
  assert.match(yml, /keytool/);
  assert.match(yml, /unzip -t/);
});

test('signed workflow uploads only the verified signed AAB and receipts', () => {
  const yml = fs.readFileSync(path, 'utf8');
  assert.match(yml, /first-check-pro-v1\.1-code4-signed\.sha256/);
  assert.match(yml, /first-check-pro-v1\.1-code4-signed-aab/);
  assert.match(yml, /signer-certificate-sha256/);
  assert.doesNotMatch(yml, /upload-artifact[\s\S]{0,500}(?:\.jks|signing\.json|keystore)/i);
});
