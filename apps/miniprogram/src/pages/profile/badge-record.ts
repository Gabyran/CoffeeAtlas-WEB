interface NextBadgeSummary {
  title: string;
  detail: string;
}

interface BadgeRecordCopyInput {
  loggedIn: boolean;
  unlockedCount: number;
  totalCount: number;
  nextBadge?: NextBadgeSummary;
}

interface BadgeRecordCopy {
  eyebrow: string;
  title: string;
  description: string;
  hint: string;
}

export function getBadgeRecordCopy({
  loggedIn,
  unlockedCount,
  totalCount,
  nextBadge,
}: BadgeRecordCopyInput): BadgeRecordCopy {
  if (!loggedIn) {
    return {
      eyebrow: 'ACHIEVEMENTS',
      title: '成就',
      description: '登录后就能开始解锁你的咖啡探索成就。',
      hint: '先解锁「入馆访客」，后面的探索成就会继续累积。',
    };
  }

  if (unlockedCount >= totalCount) {
    return {
      eyebrow: 'ACHIEVEMENTS',
      title: '成就',
      description: `已解锁 ${unlockedCount} / ${totalCount} 个成就，这一页已经被你点亮。`,
      hint:
        totalCount >= 14
          ? '当前成就已全部拿下，后续新增成就会继续加入。'
          : '首批成就已全部拿下，后续新的探索成就会继续加入。',
    };
  }

  return {
    eyebrow: 'ACHIEVEMENTS',
    title: '成就',
    description: `已解锁 ${unlockedCount} / ${totalCount} 个成就，继续把你的咖啡足迹补完整。`,
    hint: nextBadge ? `下一个是「${nextBadge.title}」：${nextBadge.detail}` : '继续收藏和浏览，新的成就会逐步点亮。',
  };
}
