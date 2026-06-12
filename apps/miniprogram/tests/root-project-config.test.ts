import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const rootProjectConfigPath = path.join(repoRoot, 'project.config.json');

test('root project.config.json points miniprogramRoot at the miniprogram build output root', () => {
  const projectConfig = JSON.parse(readFileSync(rootProjectConfigPath, 'utf8')) as {
    miniprogramRoot?: string;
  };

  const miniprogramRoot = projectConfig.miniprogramRoot ?? '';
  const sourceAppConfigPath = path.join(repoRoot, 'apps/miniprogram/src/app.config.ts');

  assert.notEqual(miniprogramRoot, '', 'root project.config.json must declare miniprogramRoot');
  assert.equal(
    miniprogramRoot,
    'apps/miniprogram/dist/',
    'root project.config.json should continue to point at the built miniprogram directory'
  );
  assert.equal(
    existsSync(sourceAppConfigPath),
    true,
    `expected app config source at ${path.relative(repoRoot, sourceAppConfigPath)}`
  );
});
