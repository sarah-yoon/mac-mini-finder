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
    bh: '',          // bhphotovideo.com — search "Mac mini M4 16GB 256GB"
    adorama: '',     // adorama.com
    expercom: '',    // expercom.com
    bestBuy: '',     // bestbuy.com
    abt: '',         // abt.com
    microCenter: '', // microcenter.com (Tustin store URL if you want store-specific)
    costco: '',      // costco.com — requires membership, may block
  },
};

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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
    inPatterns: [/add to cart/i],
    outPatterns: [/out of stock/i, /sold out online/i],
    pricePattern: /\$([0-9,]+(?:\.[0-9]{2})?)/,
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
