interface AppUserUpsertRow {
  wechat_openid: string;
  wechat_unionid?: string;
  nickname?: string;
  avatar_url?: string;
  last_login_at: string;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildAppUserUpsertRow(
  params: {
    openid: string;
    unionid?: string;
    nickname?: string;
    avatarUrl?: string;
  },
  now = new Date()
): AppUserUpsertRow {
  const row: AppUserUpsertRow = {
    wechat_openid: params.openid,
    last_login_at: now.toISOString(),
  };

  const unionid = normalizeOptionalText(params.unionid);
  const nickname = normalizeOptionalText(params.nickname);
  const avatarUrl = normalizeOptionalText(params.avatarUrl);

  if (unionid) row.wechat_unionid = unionid;
  if (nickname) row.nickname = nickname;
  if (avatarUrl) row.avatar_url = avatarUrl;

  return row;
}
