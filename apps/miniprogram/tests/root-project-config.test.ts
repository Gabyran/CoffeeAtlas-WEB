import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const miniprogramRoot = path.resolve(import.meta.dirname, '..');
const projectConfigPath = path.join(miniprogramRoot, 'project.config.json');

test('miniprogram project.config.json exists and declares miniprogramRoot', () => {
  assert.equal(
    existsSync(projectConfigPath),
    true,
    `expected project.config.json at ${path.relative(process.cwd(), projectConfigPath)}`
  );

  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8')) as {
    miniprogramRoot?: string;
  };

  assert.notEqual(
    projectConfig.miniprogramRoot ?? '',
    '',
    'project.config.json must declare miniprogramRoot'
  );

  const sourceAppConfigPath = path.join(miniprogramRoot, 'src/app.config.ts');
  assert.equal(
    existsSync(sourceAppConfigPath),
    true,
    `expected app config source at ${path.relative(miniprogramRoot, sourceAppConfigPath)}`
  );
});
