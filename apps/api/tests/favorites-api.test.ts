import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAppUserUpsertRow } from '../lib/server/app-user-upsert.ts';

test('buildAppUserUpsertRow preserves existing optional profile fields when omitted', () => {
  const row = buildAppUserUpsertRow(
    {
      openid: 'open-id',
    },
    new Date('2026-05-19T12:00:00.000Z')
  );

  assert.deepEqual(row, {
    wechat_openid: 'open-id',
    last_login_at: '2026-05-19T12:00:00.000Z',
  });
});

test('buildAppUserUpsertRow trims and includes provided WeChat profile fields', () => {
  const row = buildAppUserUpsertRow(
    {
      openid: 'open-id',
      unionid: ' union-id ',
      nickname: ' Coffee Fan ',
      avatarUrl: ' https://example.com/avatar.png ',
    },
    new Date('2026-05-19T12:00:00.000Z')
  );

  assert.deepEqual(row, {
    wechat_openid: 'open-id',
    wechat_unionid: 'union-id',
    nickname: 'Coffee Fan',
    avatar_url: 'https://example.com/avatar.png',
    last_login_at: '2026-05-19T12:00:00.000Z',
  });
});
