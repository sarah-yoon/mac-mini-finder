const CONFIG = {
  zipCode: '91205',
  maxPrice: 600,
  // Mac mini M4, 16GB unified memory, 256GB SSD (base silver).
  // If Apple pickup never triggers, verify this SKU at apple.com/shop/buy-mac/mac-mini —
  // configure the model you want, then grab the part number from the URL or "Review" page.
  applePartNumber: 'MU9D3LL/A',

  // Third-party retailer product URLs. Paste the exact 16GB/256GB M4 product page.
  // Leave blank to skip a retailer.
  targets: {
    bh: 'https://www.bhphotovideo.com/c/product/1859258-REG/apple_mu9d3ll_a_mac_mini_m4_10c_10cgpu_16gb_256gb.html',
    adorama: 'https://www.adorama.com/acmnm424.html',
    expercom: 'https://expercom.com/products/mac-mini-with-m4',
    bestBuy: 'https://www.bestbuy.com/product/apple-mac-mini-desktop-latest-model-m4-chip-built-for-apple-intelligence-16gb-memory-256gb-ssd-silver/JJGCQXH2S4',
    abt: 'https://www.abt.com/Apple-Mac-mini-Desktop-M4-Chip-16GB-RAM-256GB-SSD-Late-2024-MU9D3LLA/p/214466.html',
    microCenter: 'https://www.microcenter.com/product/688173/apple-mac-mini-mu9d3ll-a-%28late-2024%29-desktop-computer',
    costco: 'https://www.costco.com/p/-/mac-mini-desktop-computer-apple-m4-chip-built-for-apple-intelligence-10-core-cpu-10-core-gpu-16gb-memory-256gb-ssd-storage/4000225148',
    walmart: 'https://www.walmart.com/ip/Apple-Mac-mini-Apple-M4-chip-with-10C-CPU-10C-GPU-256GB-SSD-16GB-Memory-MU9D3LL-A-Fall-2024/13715211330',
    amazon: 'https://www.amazon.com/dp/B0DLBX4B1K',
    appleEducation: 'https://www.apple.com/us-edu/shop/buy-mac/mac-mini/m4-chip-10-core-cpu-10-core-gpu-16gb-memory-256gb-storage',
    appleRefurbSku: 'https://www.apple.com/shop/product/fu9d3ll/a/Refurbished-Mac-mini-Apple-M4-Chip-with-10-Core-CPU-and-10-Core-GPU-Gigabit-Ethernet-',
    smallDog: 'https://smalldog.com/products/mac-mini-m4-10-core-cpu-and-10-core-gpu',
    cdw: 'https://www.cdw.com/product/apple-mac-mini-m4-10-core-cpu-10-core-gpu-16-gb-ram-256-gb-ssd/8131050',
    amazonRenewed: 'https://www.amazon.com/Apple-10-Core-Storage-Silver-Renewed/dp/B0DTPPBN95',
    quickship: 'https://quickshipelectronics.com/products/apple-mac-mini-desktop-m4-chip-16gb-memory-256gb-ssd-silver-mu9d3ll-a-2024',
    dataVision: 'https://datavision.com/products/apple-mac-mini-apple-m4-chip-with-10c-cpu-10c-gpu-256gb-ssd-16gb-memory-mu9d3ll-a-fall-2024',
    nfm: 'https://www.nfm.com/apple-mac-mini-desktop---m4-chip---10-core---16gb-memory---256gb-ssd-in-silver-latest-model-67392910/67392910.html',
    brandsmart: 'https://www.brandsmartusa.com/apple/267668/mac-mini-m4-10cp-16gb-256gb.htm',
    connection: 'https://www.connection.com/product/apple-mac-mini-apple-m4-chip-with-10-core-cpu-and-10-core-gpu-16gb-256gb-ssd/mu9d3ll-a/41853326',
    bestBuyOpenBox: 'https://www.bestbuy.com/product/apple-mac-mini-desktop-latest-model-m4-chip-built-for-apple-intelligence-16gb-memory-256gb-ssd-silver/JJGCQXH2S4/sku/6566918/openbox?condition=fair',
  },
};

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

async function fetchText(url, timeoutMs = 40000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function checkAppleRetailPickup() {
  const url = `https://www.apple.com/shop/retail/pickup-message?parts.0=${encodeURIComponent(CONFIG.applePartNumber)}&location=${CONFIG.zipCode}`;
  const data = JSON.parse(await fetchText(url));
  const stores = data?.body?.stores ?? [];
  const available = stores.filter(
    s => s.partsAvailability?.[CONFIG.applePartNumber]?.pickupDisplay === 'available'
  );
  return {
    retailer: 'Apple Store Pickup',
    inStock: available.length > 0,
    price: 599,
    url: 'https://www.apple.com/shop/buy-mac/mac-mini/m4-chip-10-core-cpu-10-core-gpu-16gb-memory-256gb-storage',
    note: available.length ? `Pickup at: ${available.map(s => s.storeName).join(', ')}` : null,
  };
}

async function checkAppleRefurb() {
  const url = 'https://www.apple.com/shop/refurbished/mac/mac-mini';
  const text = await fetchText(url);
  const tileRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of text.matchAll(tileRegex)) {
    const tile = m[1];
    if (!/M4/i.test(tile)) continue;
    if (!/16GB/i.test(tile)) continue;
    if (!/256GB/i.test(tile)) continue;
    const priceMatch = tile.match(/\$([\d,]+)/);
    const hrefMatch = tile.match(/href="(\/shop\/product\/[^"]+)"/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;
    if (price && price <= CONFIG.maxPrice) {
      return {
        retailer: 'Apple Refurb',
        inStock: true,
        price,
        url: hrefMatch ? `https://www.apple.com${hrefMatch[1]}` : url,
      };
    }
  }
  return { retailer: 'Apple Refurb', inStock: false };
}

async function checkGeneric({ retailer, url, inPatterns, outPatterns, pricePattern }) {
  if (!url) return { retailer, inStock: false, note: 'not configured' };
  const text = await fetchText(url);
  const outOfStock = outPatterns.some(p => p.test(text));
  const inStockSignal = inPatterns.some(p => p.test(text));
  const priceMatch = pricePattern ? text.match(pricePattern) : null;
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  const inStock = inStockSignal && !outOfStock && (!price || price <= CONFIG.maxPrice);
  return { retailer, inStock, price, url };
}

const checks = [
  { name: 'Apple Store Pickup', fn: checkAppleRetailPickup },
  { name: 'Apple Refurb', fn: checkAppleRefurb },
  { name: 'B&H', fn: () => checkGeneric({
    retailer: 'B&H',
    url: CONFIG.targets.bh,
    inPatterns: [/add to cart/i, /"inStock":\s*true/],
    outPatterns: [/notify when available/i, /temporarily out of stock/i, /no longer available/i],
    pricePattern: /\$([0-9]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Adorama', fn: () => checkGeneric({
    retailer: 'Adorama',
    url: CONFIG.targets.adorama,
    inPatterns: [/add to cart/i],
    outPatterns: [/out of stock/i, /notify me/i, /backorder/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Expercom', fn: () => checkGeneric({
    retailer: 'Expercom',
    url: CONFIG.targets.expercom,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/out of stock/i, /unavailable/i, /backordered/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Best Buy', fn: () => checkGeneric({
    retailer: 'Best Buy',
    url: CONFIG.targets.bestBuy,
    inPatterns: [/"buttonState":\s*"ADD_TO_CART"/, /add to cart/i],
    outPatterns: [/sold out/i, /coming soon/i, /"buttonState":\s*"SOLD_OUT"/],
    pricePattern: /"currentPrice":\s*([0-9.]+)/,
  })},
  { name: 'Abt', fn: () => checkGeneric({
    retailer: 'Abt',
    url: CONFIG.targets.abt,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/out of stock/i, /notify me/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Micro Center', fn: () => checkGeneric({
    retailer: 'Micro Center',
    url: CONFIG.targets.microCenter,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/sold out/i, /out of stock/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Costco', fn: () => checkGeneric({
    retailer: 'Costco',
    url: CONFIG.targets.costco,
    inPatterns: [/add to cart/i, /add item/i, /"in_stock":\s*true/i, /buy now/i],
    outPatterns: [/out of stock/i, /sold out online/i, /"out_of_stock":\s*true/i, /no longer available/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Walmart', fn: () => checkGeneric({
    retailer: 'Walmart',
    url: CONFIG.targets.walmart,
    inPatterns: [/"availabilityStatus":\s*"IN_STOCK"/, /"availability_status":\s*"IN_STOCK"/],
    outPatterns: [/"availabilityStatus":\s*"OUT_OF_STOCK"/, /Out of stock/i, /This item is out of stock/i],
    pricePattern: /"currentPrice":\s*\{\s*"price":\s*([0-9.]+)/,
  })},
  { name: 'Amazon', fn: () => checkGeneric({
    retailer: 'Amazon',
    url: CONFIG.targets.amazon,
    inPatterns: [/id="availability"[^>]*>[\s\S]{0,200}In Stock/, /"availability":\s*"InStock"/, /#007600[^>]*>\s*In Stock/],
    outPatterns: [/Currently unavailable/i, /Temporarily out of stock/i, /We don't know when/i, /"availability":\s*"OutOfStock"/],
    pricePattern: /class="a-offscreen">\$([0-9,]+\.[0-9]{2})/,
  })},
  { name: 'Apple Education', fn: () => checkGeneric({
    retailer: 'Apple Education',
    url: CONFIG.targets.appleEducation,
    inPatterns: [/Add to Bag/i, /addToCart/i, /"availability":\s*"available"/i],
    outPatterns: [/Currently unavailable/i, /sold out/i, /"availability":\s*"unavailable"/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Apple Refurb SKU', fn: () => checkGeneric({
    retailer: 'Apple Refurb SKU',
    url: CONFIG.targets.appleRefurbSku,
    inPatterns: [/Add to Bag/i, /Add to Cart/i],
    outPatterns: [/Currently unavailable/i, /sold out/i, /Notify when available/i, /no longer available/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Small Dog', fn: () => checkGeneric({
    retailer: 'Small Dog',
    url: CONFIG.targets.smallDog,
    inPatterns: [/add to cart/i, /in stock/i, /"available":\s*true/i],
    outPatterns: [/sold out/i, /out of stock/i, /unavailable/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'CDW', fn: () => checkGeneric({
    retailer: 'CDW',
    url: CONFIG.targets.cdw,
    inPatterns: [/add to cart/i],
    outPatterns: [/Backordered/i, /Back In Stock Notification/i, /We'll send a notification/i, /out of stock/i, /call for availability/i, /no longer available/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Amazon Renewed', fn: () => checkGeneric({
    retailer: 'Amazon Renewed',
    url: CONFIG.targets.amazonRenewed,
    inPatterns: [/id="availability"[^>]*>[\s\S]{0,200}In Stock/, /"availability":\s*"InStock"/],
    outPatterns: [/Currently unavailable/i, /Temporarily out of stock/i, /"availability":\s*"OutOfStock"/],
    pricePattern: /class="a-offscreen">\$([0-9,]+\.[0-9]{2})/,
  })},
  { name: 'Quickship', fn: () => checkGeneric({
    retailer: 'Quickship',
    url: CONFIG.targets.quickship,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/sold out/i, /out of stock/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'DataVision', fn: () => checkGeneric({
    retailer: 'DataVision',
    url: CONFIG.targets.dataVision,
    inPatterns: [/add to cart/i, /"available":\s*true/i],
    outPatterns: [/sold out/i, /out of stock/i, /"available":\s*false/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'NFM', fn: () => checkGeneric({
    retailer: 'Nebraska Furniture Mart',
    url: CONFIG.targets.nfm,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/out of stock/i, /sold out/i, /currently unavailable/i, /back in stock notification/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'BrandsMart', fn: () => checkGeneric({
    retailer: 'BrandsMart USA',
    url: CONFIG.targets.brandsmart,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/out of stock/i, /sold out/i, /unavailable/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Connection', fn: () => checkGeneric({
    retailer: 'Connection',
    url: CONFIG.targets.connection,
    inPatterns: [/add to cart/i, /in stock/i],
    outPatterns: [/Temporarily Out-of-Stock/i, /availabilityNoStockStatus/i, /Out of Stock/i, /Backordered/i, /call for availability/i, /currently unavailable/i, /Connect with Account Team/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
  })},
  { name: 'Best Buy Open-Box', fn: () => checkGeneric({
    retailer: 'Best Buy Open-Box',
    url: CONFIG.targets.bestBuyOpenBox,
    inPatterns: [/"buttonState":\s*"ADD_TO_CART"/, /add to cart/i],
    outPatterns: [/sold out/i, /no open-box available/i, /"buttonState":\s*"SOLD_OUT"/, /not available/i],
    pricePattern: /"currentPrice":\s*([0-9.]+)/,
  })},
];

async function postDiscord(content) {
  if (!webhookUrl) {
    console.log('[no webhook set] would post:', content);
    return;
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) console.error('Discord post failed:', res.status, await res.text());
}

const results = await Promise.allSettled(checks.map(c => c.fn()));
const rows = results.map((r, i) =>
  r.status === 'fulfilled'
    ? r.value
    : { retailer: checks[i].name, inStock: false, error: r.reason?.message }
);

console.log(new Date().toISOString());
for (const row of rows) {
  const tag = row.inStock ? 'IN STOCK' : (row.error ? `err: ${row.error}` : (row.note || 'out'));
  console.log(`  ${row.retailer.padEnd(22)} ${tag}${row.price ? ` $${row.price}` : ''}`);
}

const hits = rows.filter(r => r.inStock);
if (hits.length > 0) {
  const body = hits
    .map(h => `**${h.retailer}** — ${h.price ? `$${h.price}` : 'price n/a'}${h.note ? ` — ${h.note}` : ''}\n${h.url}`)
    .join('\n\n');
  await postDiscord(`**Mac mini M4 16GB/256GB in stock (<= $${CONFIG.maxPrice})**\n\n${body}`);
}
