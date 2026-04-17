import assert from 'node:assert/strict';
import test from 'node:test';

import { getTaobaoSyncConfig, randomDelayMs } from '../lib/taobao-sync/config.ts';
import { TaobaoMcpClient } from '../lib/taobao-sync/mcp-client.ts';
import {
  mergeVisibleProductsWithSearchProducts,
  shouldSkipTrackedProductBeforeDetail,
  toPublishStatus,
} from '../lib/taobao-sync/sync.ts';
import {
  applyOcrProcessFallback,
  buildShopListingIdentity,
  cleanOcrText,
  detectTaobaoRiskSignals,
  evaluateTaobaoArrivalEligibility,
  extractProductTitlesFromShopContent,
  extractShopProductsFromContent,
  filterStructuredProducts,
  isExactShopMatch,
  normalizeTaobaoProductIdentity,
  normalizeTaobaoShopIdentity,
  parseBeanCandidateFromSources,
  shouldSkipExistingProduct,
  shouldSkipTrackedShopListingProduct,
} from '../lib/taobao-sync/parsers.ts';
import type { ExistingRoasterBeanRecord, TaobaoBinding, TaobaoStructuredProduct } from '../lib/taobao-sync/types.ts';

const binding: TaobaoBinding = {
  id: 'binding-1',
  roasterId: 'roaster-1',
  roasterName: '白鲸咖啡',
  sourceId: 'source-1',
  sourceName: '白鲸咖啡豆子店',
  canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123',
  canonicalShopName: '白鲸咖啡豆子店',
  searchKeyword: '白鲸咖啡豆子店 咖啡豆',
  isActive: true,
  lastSyncedAt: null,
};

test('normalizeTaobaoProductIdentity canonicalizes taobao, tmall, and ad-like URLs', () => {
  assert.deepEqual(normalizeTaobaoProductIdentity('https://item.taobao.com/item.htm?id=123&skuId=456'), {
    itemId: '123',
    skuId: '456',
    canonicalProductUrl: 'https://item.taobao.com/item.htm?id=123&skuId=456',
    isTmall: false,
  });

  assert.deepEqual(normalizeTaobaoProductIdentity('https://detail.tmall.com/item.htm?id=789&skuId=11'), {
    itemId: '789',
    skuId: '11',
    canonicalProductUrl: 'https://detail.tmall.com/item.htm?id=789&skuId=11',
    isTmall: true,
  });

  assert.deepEqual(
    normalizeTaobaoProductIdentity('https://s.click.taobao.com/redirect?itemId=222&skuId=333&foo=bar'),
    {
      itemId: '222',
      skuId: '333',
      canonicalProductUrl: 'https://item.taobao.com/item.htm?id=222&skuId=333',
      isTmall: false,
    }
  );
});

test('normalizeTaobaoShopIdentity keeps canonical appUid shop url', () => {
  assert.deepEqual(
    normalizeTaobaoShopIdentity('https://mobydickcoffee.taobao.com/shop/view_shop.htm?appUid=abc123&isMcp=true'),
    {
      appUid: 'abc123',
      canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123',
    }
  );
});

test('TaobaoMcpClient sends sourceApp when calling tools', async () => {
  let capturedRequest: { tool: string; arguments: Record<string, unknown> } | null = null;

  const client = new TaobaoMcpClient('http://localhost:3655/mcp', {
    toolRunner: async (request) => {
      capturedRequest = request;
      return {
        success: true,
        url: String(request.arguments.url ?? ''),
      };
    },
  });

  await client.navigateToUrl('https://store.taobao.com/shop/view_shop.htm?appUid=abc123');

  assert.equal(capturedRequest?.tool, 'navigate_to_url');
  assert.equal(capturedRequest?.arguments.sourceApp, 'coffeeatlas-taobao-sync');
  assert.equal(capturedRequest?.arguments.url, 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123');
});

test('TaobaoMcpClient unwraps nested taobao-native payloads', async () => {
  const client = new TaobaoMcpClient('http://localhost:3655/mcp', {
    toolRunner: async () => ({
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: 'https://shop.example.com',
              title: '店铺首页',
              content: '商品内容',
              totalLength: 4,
              truncated: false,
            }),
          },
        ],
      },
    }),
  });

  const result = await client.readPageContent({ maxLength: 1000 });

  assert.equal(result.title, '店铺首页');
  assert.equal(result.content, '商品内容');
  assert.equal(result.totalLength, 4);
});

test('TaobaoMcpClient propagates taobao-native tool errors', async () => {
  const client = new TaobaoMcpClient('http://localhost:3655/mcp', {
    toolRunner: async () => ({ error: '连接失败' }),
  });

  await assert.rejects(
    () => client.navigateToUrl('https://store.taobao.com/shop/view_shop.htm?appUid=abc123'),
    /连接失败/
  );
});

test('TaobaoMcpClient normalizes partial taobao-native payloads for page, history, and search helpers', async () => {
  const client = new TaobaoMcpClient('http://localhost:3655/mcp', {
    toolRunner: async (request) => {
      if (request.tool === 'read_page_content') {
        return { title: '店铺首页' };
      }
      if (request.tool === 'scan_page_elements') {
        return {};
      }
      if (request.tool === 'get_browse_history') {
        return { type: 'product', count: 1 };
      }
      if (request.tool === 'search_products') {
        return { keyword: 'CoffeeBuff旗舰店 咖啡豆' };
      }
      return {};
    },
  });

  const page = await client.readPageContent({ maxLength: 1000 });
  const scan = await client.scanPageElements();
  const history = await client.getBrowseHistory('product');
  const search = await client.searchProducts('CoffeeBuff旗舰店 咖啡豆');

  assert.equal(page.title, '店铺首页');
  assert.equal(page.content, '');
  assert.equal(page.totalLength, 0);
  assert.equal(scan.dom, '');
  assert.equal(scan.totalElements, 0);
  assert.deepEqual(history.items, []);
  assert.equal(search.keyword, 'CoffeeBuff旗舰店 咖啡豆');
  assert.deepEqual(search.products, []);
});

test('shouldSkipTrackedProductBeforeDetail only pre-skips tracked items in listing fallback mode', () => {
  const existing: ExistingRoasterBeanRecord[] = [
    {
      id: 'tracked-1',
      beanId: 'bean-1',
      displayName: '有容乃大哥伦比亚慧兰进取庄园黄帕卡玛拉厌氧蜜处理单品咖啡豆',
      priceAmount: 53.6,
      productUrl: 'https://item.taobao.com/item.htm?id=926870566313&skuId=6114749131744',
      imageUrl: 'https://example.com/bean.jpg',
      sourceItemId: '926870566313',
      sourceSkuId: '6114749131744',
      status: 'ACTIVE',
    },
  ];

  const product: TaobaoStructuredProduct = {
    title: '有容乃大哥伦比亚慧兰进取庄园黄帕卡玛拉厌氧蜜处理单品咖啡豆',
    shopName: '有容乃大咖啡补给站',
    shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123',
    productUrl: null,
    imageUrl: null,
    priceAmount: 53.6,
    sourceItemId: null,
    sourceSkuId: null,
    listingText: null,
  };

  assert.equal(shouldSkipTrackedProductBeforeDetail('listing', existing, product), true);
  assert.equal(shouldSkipTrackedProductBeforeDetail('new_arrivals', existing, product), false);
});

test('isExactShopMatch filters by exact shop identity or normalized shop name', () => {
  assert.equal(
    isExactShopMatch(binding, {
      shopName: '白鲸咖啡豆子店',
      shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123&foo=bar',
    }),
    true
  );

  assert.equal(
    isExactShopMatch(binding, {
      shopName: '别家店铺',
      shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=other',
    }),
    false
  );
});

test('extractProductTitlesFromShopContent keeps likely titles and drops noise', () => {
  const content = [
    '新品',
    '【白鲸咖啡】埃塞俄比亚 耶加雪菲 水洗 227g',
    '¥79.00',
    '已售23',
    '白鲸 SOE拼配 中深烘 227g',
    '¥89.00',
    '100人付款',
    '客服',
  ].join('\n');

  assert.deepEqual(extractProductTitlesFromShopContent(content, 5), [
    '【白鲸咖啡】埃塞俄比亚 耶加雪菲 水洗 227g',
    '白鲸 SOE拼配 中深烘 227g',
  ]);
});

test('extractProductTitlesFromShopContent drops shop headers and category labels from Taobao shop content', () => {
  const content = [
    '白鲸咖啡豆子店',
    '入选 精品咖啡豆店铺榜',
    '全部宝贝',
    '好豆#100',
    '意式咖啡豆',
    '白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆',
    '消费券',
    '¥',
    '1万+人付款',
    '【白鲸咖啡】C150 柠檬苏打 秘鲁 库斯科Julio Chávez 瑰夏水洗',
    '满2件9.5折',
    '¥',
    '19人付款',
  ].join('\n');

  assert.deepEqual(extractProductTitlesFromShopContent(content, 10), [
    '白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆',
    '【白鲸咖啡】C150 柠檬苏打 秘鲁 库斯科Julio Chávez 瑰夏水洗',
  ]);
});

test('extractShopProductsFromContent prefers real price over promotion copy', () => {
  const content = [
    '【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗',
    '消费券 已降3元 退货宝',
    '¥',
    '109',
    '200+人付款',
  ].join('\n');

  const products = extractShopProductsFromContent(content, 10, binding);
  assert.equal(products[0]?.priceAmount, 109);
  assert.equal(products[0]?.sourceItemId, buildShopListingIdentity('【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗'));
});

test('filterStructuredProducts keeps only strong title matches when visible titles exist', () => {
  const products = [
    {
      title: '白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆',
      productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      price: '79',
    },
    {
      title: '白鲸咖啡 ORIGAMI Air S号 折纸手冲咖啡滤杯蛋糕V60 日本',
      productUrl: 'https://item.taobao.com/item.htm?id=102&skuId=2',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      price: '199',
    },
    {
      title: '肯尼亚 水洗 227g',
      productUrl: 'https://item.taobao.com/item.htm?id=103&skuId=3',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      price: '88',
    },
  ];

  assert.deepEqual(
    filterStructuredProducts(
      binding,
      products,
      ['白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆'],
      10
    ).map((item) => item.sourceItemId),
    ['101']
  );
});

test('cleanOcrText normalizes OCR punctuation and spacing', () => {
  assert.equal(cleanOcrText('云南|保山  水洗\n227g'), '云南 保山 水洗 227g');
});

test('applyOcrProcessFallback supplements missing process method from OCR only', () => {
  const candidate = parseBeanCandidateFromSources({
    displayName: '巴拿马 瑰夏 100g',
    titleText: '巴拿马 瑰夏 100g',
  });

  const enriched = applyOcrProcessFallback(candidate, '商品图文：巴拿马 瑰夏 日晒 100g');

  assert.equal(candidate.processMethod, null);
  assert.equal(enriched.processMethod, 'Natural');
  assert.equal(enriched.beanName, candidate.beanName);
  assert.equal(enriched.originCountry, candidate.originCountry);
  assert.equal(enriched.parseSource, candidate.parseSource);
  assert.ok(enriched.parseWarnings.includes('process_method_from_ocr'));
});

test('applyOcrProcessFallback does not override existing title or page process method', () => {
  const candidate = parseBeanCandidateFromSources({
    displayName: '哥伦比亚 慧兰 水洗 100g',
    titleText: '哥伦比亚 慧兰 水洗 100g',
  });

  const enriched = applyOcrProcessFallback(candidate, '商品图文：哥伦比亚 慧兰 日晒 100g');

  assert.equal(candidate.processMethod, 'Washed');
  assert.equal(enriched.processMethod, 'Washed');
  assert.deepEqual(enriched, candidate);
});

test('parseBeanCandidateFromSources parses from title, page, OCR, and vision fallback', () => {
  const titleCandidate = parseBeanCandidateFromSources({
    displayName: '埃塞俄比亚 耶加雪菲 水洗 227g',
    titleText: '埃塞俄比亚 耶加雪菲 水洗 227g',
  });
  assert.equal(titleCandidate.beanName, 'Ethiopia Yirgacheffe');
  assert.equal(titleCandidate.originCountry, 'Ethiopia');
  assert.equal(titleCandidate.originRegion, 'Yirgacheffe');
  assert.equal(titleCandidate.processMethod, 'Washed');
  assert.equal(titleCandidate.weightGrams, 227);
  assert.equal(titleCandidate.parseSource, 'title');

  const shorthandCandidate = parseBeanCandidateFromSources({
    displayName: '【白鲸咖啡】omni烘焙 沙丘 埃塞西达玛Aklilu Gonjobe74158日晒',
    titleText: '【白鲸咖啡】omni烘焙 沙丘 埃塞西达玛Aklilu Gonjobe74158日晒',
  });
  assert.equal(shorthandCandidate.originCountry, 'Ethiopia');
  assert.equal(shorthandCandidate.originRegion, 'Sidamo');
  assert.equal(shorthandCandidate.processMethod, 'Natural');

  const pageCandidate = parseBeanCandidateFromSources({
    displayName: '白鲸限量豆',
    titleText: '白鲸限量豆',
    pageText: '哥伦比亚 慧兰 粉红波旁 厌氧日晒 100g',
  });
  assert.equal(pageCandidate.parseSource, 'page');
  assert.equal(pageCandidate.beanName, 'Colombia Huila');
  assert.equal(pageCandidate.variety, 'Pink Bourbon');
  assert.equal(pageCandidate.weightGrams, 100);

  const ocrCandidate = parseBeanCandidateFromSources({
    displayName: '新品咖啡豆',
    titleText: '新品咖啡豆',
    ocrText: '巴拿马 瑰夏 日晒 100g',
  });
  assert.equal(ocrCandidate.parseSource, 'ocr');
  assert.equal(ocrCandidate.beanName, 'Panama Geisha');

  const visionCandidate = parseBeanCandidateFromSources({
    displayName: '神秘豆子',
    titleText: '神秘豆子',
    visionCandidate: {
      beanName: 'Kenya Nyeri',
      originCountry: 'Kenya',
      originRegion: 'Nyeri',
      processMethod: 'Washed',
      weightGrams: 200,
    },
  });
  assert.equal(visionCandidate.parseSource, 'vision');
  assert.equal(visionCandidate.beanName, 'Kenya Nyeri');
});

test('parseBeanCandidateFromSources prefers visual candidate and records blocking conflicts when title disagrees', () => {
  const candidate = parseBeanCandidateFromSources({
    displayName: '肯尼亚 涅里 水洗 227g',
    titleText: '埃塞俄比亚 耶加雪菲 水洗 227g',
    ocrText: '肯尼亚 涅里 水洗 227g',
    visionCandidate: {
      beanName: 'Kenya Nyeri',
      originCountry: 'Kenya',
      originRegion: 'Nyeri',
      processMethod: 'Washed',
      weightGrams: 227,
    },
  });

  assert.equal(candidate.parseSource, 'vision');
  assert.equal(candidate.beanName, 'Kenya Nyeri');
  assert.ok(candidate.conflicts?.some((conflict) => conflict.field === 'beanName' && conflict.severity === 'blocking'));
  assert.ok(candidate.parseWarnings.includes('conflict:blocking:beanName:title:vision'));
});

test('parseBeanCandidateFromSources keeps warning-level conflicts without forcing visual takeover', () => {
  const candidate = parseBeanCandidateFromSources({
    displayName: '哥伦比亚 慧兰 100g',
    titleText: '哥伦比亚 慧兰 水洗 100g',
    visionCandidate: {
      beanName: 'Colombia Huila',
      originCountry: 'Colombia',
      originRegion: 'Huila',
      processMethod: 'Natural',
      weightGrams: 100,
    },
  });

  assert.equal(candidate.originCountry, 'Colombia');
  assert.ok(candidate.conflicts?.some((conflict) => conflict.field === 'processMethod' && conflict.severity === 'warning'));
  assert.ok(candidate.parseWarnings.includes('conflict:warning:processMethod:title:vision'));
  assert.equal(toPublishStatus(candidate), 'ACTIVE');
});

test('toPublishStatus marks blocking source conflicts as draft', () => {
  const candidate = parseBeanCandidateFromSources({
    displayName: '肯尼亚 涅里 水洗 227g',
    titleText: '埃塞俄比亚 耶加雪菲 水洗 227g',
    ocrText: '肯尼亚 涅里 水洗 227g',
    visionCandidate: {
      beanName: 'Kenya Nyeri',
      originCountry: 'Kenya',
      originRegion: 'Nyeri',
      processMethod: 'Washed',
      weightGrams: 227,
    },
  });

  assert.equal(toPublishStatus(candidate), 'DRAFT');
});

test('evaluateTaobaoArrivalEligibility skips espresso blend listings before detail enrichment', () => {
  const result = evaluateTaobaoArrivalEligibility({
    displayName: '白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆',
    titleText: '白鲸咖啡 三重奏 意式浓缩拼配 美式意式 黑咖啡 精品咖啡豆',
    pageText: '中深烘 227g',
  });

  assert.equal(result.shouldImport, false);
  assert.equal(result.reason, 'espresso_blend');
});

test('evaluateTaobaoArrivalEligibility keeps single-origin omni listings', () => {
  const result = evaluateTaobaoArrivalEligibility({
    displayName: '甜茶 卢旺达红波旁 白蜜处理 omni烘焙 精品意式手冲',
    titleText: '甜茶 卢旺达红波旁 白蜜处理 omni烘焙 精品意式手冲',
    pageText: 'Rwanda Red Bourbon Honey 227g',
  });

  assert.equal(result.shouldImport, true);
  assert.equal(result.reason, 'eligible');
  assert.equal(result.candidate.originCountry, 'Rwanda');
});

test('evaluateTaobaoArrivalEligibility skips single-origin latte style listings', () => {
  const result = evaluateTaobaoArrivalEligibility({
    displayName: '【Terraform】25产季 微批次洪都拉斯水洗中烘意式奶咖单一咖啡豆',
    titleText: '【Terraform】25产季 微批次洪都拉斯水洗中烘意式奶咖单一咖啡豆',
    pageText: 'Honduras Washed',
  });

  assert.equal(result.shouldImport, false);
  assert.equal(result.reason, 'non_target_style');
});

test('evaluateTaobaoArrivalEligibility skips cold brew dedicated listings', () => {
  const result = evaluateTaobaoArrivalEligibility({
    displayName: '白鲸咖啡 冷萃专用豆 夏日特调',
    titleText: '白鲸咖啡 冷萃专用豆 夏日特调',
    pageText: 'Cold Brew Blend 227g',
  });

  assert.equal(result.shouldImport, false);
  assert.equal(result.reason, 'cold_brew');
});

test('shouldSkipExistingProduct requires unchanged identity and normalized url', () => {
  const existing: ExistingRoasterBeanRecord = {
    id: 'rb-1',
    beanId: 'bean-1',
    displayName: '埃塞俄比亚 耶加雪菲 水洗 227g',
    priceAmount: 79,
    productUrl: 'https://item.taobao.com/item.htm?id=123&skuId=456',
    imageUrl: null,
    sourceItemId: '123',
    sourceSkuId: '456',
    status: 'ACTIVE',
  };

  const same: TaobaoStructuredProduct = {
    title: '埃塞俄比亚 耶加雪菲 水洗 227g',
    shopName: '白鲸咖啡豆子店',
    shopUrl: binding.canonicalShopUrl,
    productUrl: 'https://s.click.taobao.com/redirect?itemId=123&skuId=456',
    imageUrl: null,
    priceAmount: 79,
    sourceItemId: '123',
    sourceSkuId: '456',
  };

  const changed: TaobaoStructuredProduct = {
    ...same,
    priceAmount: 81,
  };

  assert.equal(shouldSkipExistingProduct(existing, same), true);
  assert.equal(shouldSkipExistingProduct(existing, changed), false);
});

test('shouldSkipTrackedShopListingProduct skips titles already tracked in current db', () => {
  const existing: ExistingRoasterBeanRecord[] = [
    {
      id: 'rb-1',
      beanId: 'bean-1',
      displayName: '【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗',
      priceAmount: 79,
      productUrl: 'https://item.taobao.com/item.htm?id=1014679874311',
      imageUrl: 'https://img.alicdn.com/bean-1.jpg',
      sourceItemId: '1014679874311',
      sourceSkuId: null,
      status: 'ACTIVE',
    },
  ];

  assert.equal(
    shouldSkipTrackedShopListingProduct(existing, {
      title: '【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      productUrl: null,
      imageUrl: null,
      priceAmount: 109,
      sourceItemId: null,
      sourceSkuId: null,
    }),
    true
  );
});

test('shouldSkipTrackedShopListingProduct does not skip legacy rows without source identity', () => {
  const existing: ExistingRoasterBeanRecord[] = [
    {
      id: 'rb-legacy-1',
      beanId: 'bean-1',
      displayName: '【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗',
      priceAmount: 79,
      productUrl: null,
      imageUrl: null,
      sourceItemId: null,
      sourceSkuId: null,
      status: 'ACTIVE',
    },
  ];

  assert.equal(
    shouldSkipTrackedShopListingProduct(existing, {
      title: '【白鲸咖啡】C149 白花橙子 秘鲁 库斯科 SL09 水洗',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      productUrl: null,
      imageUrl: null,
      priceAmount: 109,
      sourceItemId: null,
      sourceSkuId: null,
    }),
    false
  );
});

test('detectTaobaoRiskSignals catches captcha and login issues', () => {
  const signals = detectTaobaoRiskSignals(['请完成验证后继续访问', '登录已过期']);
  assert.deepEqual(
    signals.map((signal) => signal.reason),
    ['captcha', 'login_required']
  );
});

test('shouldSkipTrackedShopListingProduct keeps incomplete tracked rows eligible for re-enrichment', () => {
  const existing: ExistingRoasterBeanRecord[] = [
    {
      id: 'row-1',
      beanId: 'bean-1',
      displayName: '河川水流 2026 埃塞俄比亚 Elto 咖啡 Bona水洗站 74158 水洗',
      priceAmount: 99,
      productUrl: null,
      imageUrl: null,
      sourceItemId: 'listing:河川水流2026埃塞俄比亚elto咖啡bona水洗站74158水洗',
      sourceSkuId: null,
      status: 'ACTIVE',
    },
  ];

  assert.equal(
    shouldSkipTrackedShopListingProduct(existing, {
      title: '河川水流 2026 埃塞俄比亚 Elto 咖啡 Bona水洗站 74158 水洗',
      shopName: '河川水流 MoveRiverCoffee',
      shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=movriver',
      productUrl: null,
      imageUrl: null,
      priceAmount: 99,
      sourceItemId: 'listing:河川水流2026埃塞俄比亚elto咖啡bona水洗站74158水洗',
      sourceSkuId: null,
    }),
    false
  );
});

test('mergeVisibleProductsWithSearchProducts supplements exact-shop search matches without duplicating listing rows', () => {
  const visibleProducts: TaobaoStructuredProduct[] = [
    {
      title: '【Terraform】2025产季 黑布林 乌梅 卢旺达蜜处理Bourbon咖啡豆',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      productUrl: null,
      imageUrl: null,
      priceAmount: null,
      sourceItemId: buildShopListingIdentity('【Terraform】2025产季 黑布林 乌梅 卢旺达蜜处理Bourbon咖啡豆'),
      sourceSkuId: null,
    },
  ];

  const merged = mergeVisibleProductsWithSearchProducts({
    binding: {
      ...binding,
      canonicalShopName: '啟程拓殖Terraform Coffee',
      canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=terraform-shop',
    },
    visibleProducts,
    searchProducts: [
      {
        title: '【Terraform】2025产季 黑布林 乌梅 卢旺达蜜处理Bourbon咖啡豆',
        productUrl: 'https://item.taobao.com/item.htm?id=1001',
        image: 'https://img.alicdn.com/terraform-rwanda.jpg',
        shopName: '啟程拓殖Terraform Coffee',
        shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=terraform-shop',
        price: '51',
      },
      {
        title: '【Terraform】“豆种漫邮”25/26产季 厄瓜多尔Sidra蜜处理咖啡豆',
        productUrl: 'https://item.taobao.com/item.htm?id=1002',
        shopName: '啟程拓殖Terraform Coffee',
        shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=terraform-shop',
        price: '74.29',
      },
      {
        title: '别家店的豆子',
        productUrl: 'https://item.taobao.com/item.htm?id=1003',
        shopName: '别家店',
        shopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=other-shop',
        price: '88',
      },
    ],
  });

  assert.equal(merged.length, 2);
  assert.ok(merged.some((item) => item.title.includes('Sidra')));
  assert.equal(merged.filter((item) => item.title.includes('卢旺达')).length, 1);
  assert.deepEqual(
    merged.find((item) => item.title.includes('卢旺达')),
    {
      title: '【Terraform】2025产季 黑布林 乌梅 卢旺达蜜处理Bourbon咖啡豆',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      productUrl: 'https://item.taobao.com/item.htm?id=1001',
      imageUrl: 'https://img.alicdn.com/terraform-rwanda.jpg',
      priceAmount: 51,
      sourceItemId: buildShopListingIdentity('【Terraform】2025产季 黑布林 乌梅 卢旺达蜜处理Bourbon咖啡豆'),
      sourceSkuId: null,
    }
  );
});

test('taobao sync config keeps single-thread anti-bot defaults', () => {
  const previous = {
    TAOBAO_SYNC_MAX_ITEMS_PER_SHOP: process.env.TAOBAO_SYNC_MAX_ITEMS_PER_SHOP,
    TAOBAO_SYNC_DELAY_MIN_MS: process.env.TAOBAO_SYNC_DELAY_MIN_MS,
    TAOBAO_SYNC_DELAY_MAX_MS: process.env.TAOBAO_SYNC_DELAY_MAX_MS,
  };

  delete process.env.TAOBAO_SYNC_MAX_ITEMS_PER_SHOP;
  delete process.env.TAOBAO_SYNC_DELAY_MIN_MS;
  delete process.env.TAOBAO_SYNC_DELAY_MAX_MS;

  const config = getTaobaoSyncConfig();
  assert.equal(config.maxItemsPerShop, 20);
  assert.equal(config.maxShopRetries, 1);

  for (let index = 0; index < 20; index += 1) {
    const delay = randomDelayMs(config);
    assert.ok(delay >= config.delayMinMs);
    assert.ok(delay <= config.delayMaxMs);
  }

  Object.assign(process.env, previous);
});
