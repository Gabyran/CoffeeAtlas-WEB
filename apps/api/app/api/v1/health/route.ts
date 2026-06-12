import { apiSuccess } from '@/lib/server/api-helpers';
import { hasDatabaseEnv } from '@/lib/server/database';

function hasWechatConfig() {
  return Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET);
}

function hasJwtConfig() {
  return Boolean(process.env.APP_JWT_SECRET);
}

export async function GET() {
  return apiSuccess({
    service: 'coffeeatlas-web',
    ts: new Date().toISOString(),
    databaseConfigured: hasDatabaseEnv(),
    wechatConfigured: hasWechatConfig(),
    jwtConfigured: hasJwtConfig(),
  });
}
