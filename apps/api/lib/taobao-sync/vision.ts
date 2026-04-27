import type { TaobaoSyncConfig, VisionBeanCandidate } from './types.ts';

function buildEndpoint(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

export async function runVisionBeanFallback(args: {
  config: Pick<TaobaoSyncConfig, 'visionApiKey' | 'visionBaseUrl' | 'visionModel'>;
  imageUrl: string;
  title: string;
  ocrText?: string | null;
}): Promise<VisionBeanCandidate | null> {
  if (!args.config.visionBaseUrl || !args.config.visionApiKey || !args.config.visionModel) {
    return null;
  }

  const response = await fetch(buildEndpoint(args.config.visionBaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.visionApiKey}`,
    },
    body: JSON.stringify({
      model: args.config.visionModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract coffee bean info from ecommerce images. Return JSON only with keys: beanName, originCountry, originRegion, processMethod, variety, roastLevel, weightGrams, parseWarnings.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `商品标题: ${args.title}\nOCR 文本: ${args.ocrText ?? ''}\n请只提取你有把握的信息；不确定请返回 null，并把原因放到 parseWarnings 数组。weightGrams 返回数字。`,
            },
            {
              type: 'image_url',
              image_url: {
                url: args.imageUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Vision request failed: ${response.status} ${body}`);
  }

  let payload: {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return null;
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  const json = extractJsonObject(content);
  if (!json) return null;

  try {
    return JSON.parse(json) as VisionBeanCandidate;
  } catch {
    return null;
  }
}
