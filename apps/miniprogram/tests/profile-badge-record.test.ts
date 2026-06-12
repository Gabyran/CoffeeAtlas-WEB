import assert from 'node:assert/strict';
import test from 'node:test';

import { getBadgeRecordCopy } from '../src/pages/profile/badge-record.ts';

test('getBadgeRecordCopy returns login prompt copy for guests', () => {
  assert.deepEqual(getBadgeRecordCopy({ loggedIn: false, unlockedCount: 0, totalCount: 6 }), {
    eyebrow: 'ACHIEVEMENTS',
    title: '成就',
    description: '登录后就能开始解锁你的咖啡探索成就。',
    hint: '先解锁「入馆访客」，后面的探索成就会继续累积。',
  });
});

test('getBadgeRecordCopy returns progress copy with next badge guidance', () => {
  assert.deepEqual(
    getBadgeRecordCopy({
      loggedIn: true,
      unlockedCount: 2,
      totalCount: 6,
      nextBadge: {
        title: '豆单收藏家',
        detail: '再收藏 2 款豆子可解锁。',
      },
    }),
    {
      eyebrow: 'ACHIEVEMENTS',
      title: '成就',
      description: '已解锁 2 / 6 个成就，继续把你的咖啡足迹补完整。',
      hint: '下一个是「豆单收藏家」：再收藏 2 款豆子可解锁。',
    },
  );
});

test('getBadgeRecordCopy returns completion copy when all badges are unlocked', () => {
  assert.deepEqual(getBadgeRecordCopy({ loggedIn: true, unlockedCount: 6, totalCount: 6 }), {
    eyebrow: 'ACHIEVEMENTS',
    title: '成就',
    description: '已解锁 6 / 6 个成就，这一页已经被你点亮。',
    hint: '首批成就已全部拿下，后续新的探索成就会继续加入。',
  });
});
