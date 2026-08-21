import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const yml = fs.readFileSync('.github/workflows/android-store-public.yml', 'utf8');

test('store workflow can verify pull requests targeting main', () => {
  assert.match(yml, /pull_request:/);
  assert.match(yml, /pull_request:[\s\S]*branches:\s*\[main\]/);
});

test('PR verification never writes build receipts to main', () => {
  const guarded = (name) => new RegExp(`- name: ${name}\\n\\s+if: [^\\n]*github\\.event_name != 'pull_request'`);
  assert.match(yml, guarded('Record build start'));
  assert.match(yml, guarded('Record build result'));
});

test('PR verification uploads reconstructed billing inspection evidence', () => {
  assert.match(yml, /first-check-pro-pr-inspection/);
  assert.match(yml, /apps\/mobile\/src\/billing/);
});

test('PR diagnostics expose only billing source before the billing gate', () => {
  const diagnostic = yml.indexOf('- name: Diagnose PR Pro billing source before gate');
  const gate = yml.indexOf('- name: Verify Pro billing + paywall contract');
  assert.ok(diagnostic >= 0, 'missing PR-only billing diagnostic step');
  assert.ok(gate > diagnostic, 'billing diagnostic must run before the billing gate');
  assert.match(yml, /build-src\/apps\/mobile\/app\/pro\.tsx/);
  assert.match(yml, /build-src\/apps\/mobile\/src\/billing/);
});
