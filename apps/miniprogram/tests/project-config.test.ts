import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectConfigPath = path.resolve(import.meta.dirname, '../project.config.json');

test('miniprogram project.config.json disables url check for dev preview', () => {
  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8')) as {
    setting?: { urlCheck?: boolean; compileHotReLoad?: boolean };
  };

  assert.equal(projectConfig.setting?.urlCheck, false);
  assert.equal(projectConfig.setting?.compileHotReLoad, true);
});
