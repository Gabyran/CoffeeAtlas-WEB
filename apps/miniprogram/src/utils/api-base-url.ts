const PLACEHOLDER_PATTERN = /YOUR_LAN_IP|your-domain\.com/i;
const LOOPBACK_IPV4_PATTERN = /^127(?:\.\d{1,3}){3}$/;

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || LOOPBACK_IPV4_PATTERN.test(hostname);
}

export function normalizeApiBaseUrl(url: string | null | undefined): string {
  return (url ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

export function getApiBaseUrlHostname(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
}

export function isPrivateIpv4(hostname: string): boolean {
  return (
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function getApiBaseUrlValidationError(url: string): string | null {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) return null;

  if (PLACEHOLDER_PATTERN.test(normalized)) {
    return '当前 TARO_APP_API_URL 还是占位值，请改成真实地址。';
  }

  const hostname = getApiBaseUrlHostname(normalized);

  if (isLoopbackHostname(hostname)) {
    return '微信开发者工具里不能使用 localhost 或 127.0.0.1 作为 API 地址，请改成局域网 IP 或线上域名。';
  }

  if (/vercel-app$/i.test(hostname) && !/\.vercel\.app$/i.test(hostname)) {
    return 'API 地址看起来写错了：你可能把 `.vercel.app` 写成了 `-vercel-app`。请改成类似 `https://你的项目.vercel.app`。';
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return 'API 地址必须以 http:// 或 https:// 开头。';
  }

  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname) {
      return 'API 地址缺少域名，请检查后重试。';
    }
  } catch {
    return 'API 地址格式不正确，请检查后重试。';
  }

  return null;
}
