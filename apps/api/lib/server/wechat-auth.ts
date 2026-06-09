import { HttpError } from './api-primitives.ts';

interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

function getWechatConfig() {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) {
    throw new HttpError(500, 'wechat_config_missing', 'WeChat app credentials not configured');
  }
  return { appId, appSecret };
}

export async function code2Session(code: string): Promise<{ openid: string; unionid?: string }> {
  const { appId, appSecret } = getWechatConfig();
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpError(502, 'wechat_api_error', 'Failed to reach WeChat API');
  }

  const json = (await res.json()) as Code2SessionResponse;
  if (json.errcode) {
    throw new HttpError(401, 'wechat_login_failed', json.errmsg ?? 'WeChat login failed');
  }

  const openid = typeof json.openid === 'string' ? json.openid.trim() : '';
  if (!openid) {
    throw new HttpError(502, 'wechat_api_error', 'WeChat login response missing openid');
  }
  const unionid = typeof json.unionid === 'string' && json.unionid.trim() ? json.unionid.trim() : undefined;

  return { openid, unionid };
}
