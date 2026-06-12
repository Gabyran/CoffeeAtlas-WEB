import assert from 'node:assert/strict';
import test from 'node:test';

import { getProfileBadges } from '../src/pages/profile/profile-badges.ts';

test('getProfileBadges keeps all badges locked for guests', () => {
  const badges = getProfileBadges({
    loggedIn: false,
    beanFavorites: 0,
    roasterFavorites: 0,
    historyCount: 0,
  });

  assert.equal(badges.length, 14);
  assert.equal(badges.every((badge) => badge.unlocked === false), true);

  const loginBadge = badges.find((badge) => badge.id === 'visitor');
  assert.ok(loginBadge);
  assert.equal(loginBadge.detail, '登录后即可解锁这个成就。');
});

test('getProfileBadges unlocks the login badge for signed-in users', () => {
  const badges = getProfileBadges({
    loggedIn: true,
    beanFavorites: 0,
    roasterFavorites: 0,
    historyCount: 0,
  });

  const loginBadge = badges.find((badge) => badge.id === 'visitor');
  assert.ok(loginBadge);
  assert.equal(loginBadge.unlocked, true);
  assert.equal(loginBadge.progressLabel, '已完成');
});

test('getProfileBadges unlocks bean collection badges at the right thresholds', () => {
  const badges = getProfileBadges({
    loggedIn: true,
    beanFavorites: 5,
    roasterFavorites: 0,
    historyCount: 0,
  });

  const beanStarter = badges.find((badge) => badge.id === 'bean-starter');
  const beanCollector = badges.find((badge) => badge.id === 'bean-collector');

  assert.ok(beanStarter);
  assert.ok(beanCollector);
  assert.equal(beanStarter.unlocked, true);
  assert.equal(beanCollector.unlocked, true);
});

test('getProfileBadges unlocks exploration, purchase, and share badges at PRD thresholds', () => {
  const badges = getProfileBadges({
    loggedIn: true,
    beanFavorites: 5,
    roasterFavorites: 1,
    historyCount: 10,
    uniqueCountries: 3,
    continentsCovered: 3,
    uniqueProcesses: 4,
    uniqueVarieties: 3,
    purchaseClicks: 1,
    uniqueRoasterPurchaseClicks: 3,
    shareCount: 5,
  });

  const originScout = badges.find((badge) => badge.id === 'origin-scout');
  const originAtlas = badges.find((badge) => badge.id === 'origin-atlas');
  const processNerd = badges.find((badge) => badge.id === 'process-nerd');
  const varietyHunter = badges.find((badge) => badge.id === 'variety-hunter');
  const firstClick = badges.find((badge) => badge.id === 'first-click');
  const multiRoaster = badges.find((badge) => badge.id === 'multi-roaster');
  const firstShare = badges.find((badge) => badge.id === 'first-share');
  const serialSharer = badges.find((badge) => badge.id === 'serial-sharer');

  assert.ok(originScout);
  assert.ok(originAtlas);
  assert.ok(processNerd);
  assert.ok(varietyHunter);
  assert.ok(firstClick);
  assert.ok(multiRoaster);
  assert.ok(firstShare);
  assert.ok(serialSharer);
  assert.equal(originScout.unlocked, true);
  assert.equal(originAtlas.unlocked, true);
  assert.equal(processNerd.unlocked, true);
  assert.equal(varietyHunter.unlocked, true);
  assert.equal(firstClick.unlocked, true);
  assert.equal(multiRoaster.unlocked, true);
  assert.equal(firstShare.unlocked, true);
  assert.equal(serialSharer.unlocked, true);
});

test('getProfileBadges treats synced badge ids as unlocked even when local metrics are missing', () => {
  const badges = getProfileBadges({
    loggedIn: true,
    beanFavorites: 0,
    roasterFavorites: 0,
    historyCount: 0,
    externallyUnlockedBadgeIds: ['first-share', 'origin-scout'],
  });

  const firstShare = badges.find((badge) => badge.id === 'first-share');
  const originScout = badges.find((badge) => badge.id === 'origin-scout');

  assert.ok(firstShare);
  assert.ok(originScout);
  assert.equal(firstShare.unlocked, true);
  assert.equal(originScout.unlocked, true);
});

test('getProfileBadges computes remaining progress for locked badges', () => {
  const badges = getProfileBadges({
    loggedIn: true,
    beanFavorites: 3,
    roasterFavorites: 0,
    historyCount: 4,
    uniqueCountries: 1,
    continentsCovered: 1,
    uniqueProcesses: 2,
    uniqueVarieties: 1,
    purchaseClicks: 0,
    uniqueRoasterPurchaseClicks: 1,
    shareCount: 1,
  });

  const beanCollector = badges.find((badge) => badge.id === 'bean-collector');
  const historyRegular = badges.find((badge) => badge.id === 'history-regular');
  const originScout = badges.find((badge) => badge.id === 'origin-scout');
  const firstClick = badges.find((badge) => badge.id === 'first-click');
  const serialSharer = badges.find((badge) => badge.id === 'serial-sharer');

  assert.ok(beanCollector);
  assert.ok(historyRegular);
  assert.ok(originScout);
  assert.ok(firstClick);
  assert.ok(serialSharer);
  assert.equal(beanCollector.unlocked, false);
  assert.equal(beanCollector.remainingValue, 2);
  assert.equal(beanCollector.detail, '再收藏 2 款豆子可解锁。');
  assert.equal(historyRegular.unlocked, false);
  assert.equal(historyRegular.detail, '再浏览 6 条记录可解锁。');
  assert.equal(originScout.unlocked, false);
  assert.equal(originScout.detail, '再探索 2 个不同产地可解锁。');
  assert.equal(firstClick.detail, '再点击 1 次购买链接可解锁。');
  assert.equal(serialSharer.detail, '再分享 4 次可解锁。');
});
