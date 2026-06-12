import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const beanDetailFile = path.join(projectRoot, 'src/pages/bean-detail/index.tsx');
const beanDetailConfigFile = path.join(projectRoot, 'src/pages/bean-detail/index.config.ts');

test('bean detail page enables share menu and uses the roaster detail link', () => {
  const source = readFileSync(beanDetailFile, 'utf8');

  assert.match(source, /useShareAppMessage/);
  assert.match(source, /useShareTimeline/);
  assert.match(source, /openType="share"/);
  assert.match(source, /getRoasterById/);
  assert.match(source, /bean-detail__bottom-bar/);
  assert.match(source, /bean-detail__roaster-section/);
  assert.match(source, /getBeanPurchaseUrl/);
});

test('bean detail page config enables app message and timeline sharing', () => {
  const source = readFileSync(beanDetailConfigFile, 'utf8');

  assert.match(source, /enableShareAppMessage:\s*true/);
  assert.match(source, /enableShareTimeline:\s*true/);
});
