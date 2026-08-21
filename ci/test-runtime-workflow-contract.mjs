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
