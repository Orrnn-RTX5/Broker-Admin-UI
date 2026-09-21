import { defaultCategory } from './instrumentForm.js';
import { normalizeArrayResponse } from './apiShapes.js';

export const marketCategories = ['Metals', 'Forex', 'Indices', 'Crypto', 'Commodities', 'Others'];
const name = row => String(typeof row === 'string' ? row : row?.symbol || row?.Symbol || '').trim().toUpperCase();

const currencies = new Set('AED ARS AUD BRL CAD CHF CLP CNH CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON RUB SAR SEK SGD THB TRY TWD USD ZAR'.split(' '));
const cryptoBases = new Set('BTC ETH SOL XRP LTC BCH ADA DOGE DOT LINK LNK BNB AVAX AVX MATIC TRX UNI AAVE AERO ALGO APT ARB ASTER ATOM BONK BRETT CAKE CFX COAI COMP CRO CRV DEXE DYDX ENA ENS ETC FARTCOIN FET FIL FLOKI FLOW GALA GLM GLMR GRT HBAR HYPE ICP IMX INJ IOTA IP JTO JUP KAIA KSM LDO MANA MORPHO MYX NEAR ONDO OP PENDLE PENGU PEPE PI POL PUMP PYTH QNT RAY RENDER SAND SEI SHIB SNX STRK STX SUI SYRUP TAO THETA TIA TON TRUMP TWT VET VIRTUAL WAL WIF WLD WLFI XLM XMR XPL XTZ ZEC PAXG XAUT'.split(' '));
const indices = new Set('CHINAH CN50 CHINA50 CHN50 EURX EUSTX50 GOLDINDEX HSTECH JPYX KR200 NETH25 SCI25 SPA35 ESP35 SWI20 TWN US2000 US400 USDX VIX GER30 DAX CAC FTSE DJI NDX'.split(' '));
const commodities = new Set('WTI BRENT USOIL UKOIL OIL NATGAS NGAS COFFEE SUGAR LDSUGAR CORN WHEAT COCOA COTTON SOYBEANS SOYBEAN SBEAN ALUMINIUM COPPER LEAD NICKEL ZINC GASOLINE CRUDE SPOTBRENT SPOTCRUDE BRENTOIL WTOIL'.split(' '));
const bonds = new Set('EUBOBL EUBUND UKGILT US_TBOND USTN10YR USTN2YR USTN5YR'.split(' '));

export function inferMarketCategory(symbol) {
  // Exchange-qualified equity names must be checked before stripping suffixes.
  // This avoids mistaking stock names such as SAN.FR or SPX.GB for other assets.
  if (/^[A-Z0-9.]+\.(US|GB|DE|FR|CH|BE|ES|NO|SE|DK|PT|IE|AT|FI|CN|HK|KR)(?:-(?:24|PERP))?$/.test(symbol)) return 'Stocks';
  const root = symbol.replace(/-(?:F|PERP)$/, '').split('.')[0];
  if (bonds.has(root)) return 'Bonds';
  if (indices.has(root)) return 'Indices';
  if (commodities.has(root)) return 'Commodities';
  if (root.length === 6 && currencies.has(root.slice(0, 3)) && currencies.has(root.slice(3)) && root.slice(0, 3) !== root.slice(3)) return 'Forex';
  if (cryptoBases.has(root) || [...currencies, 'USDT', 'USDC', 'BTC', 'ETH'].some(quote => root.endsWith(quote) && cryptoBases.has(root.slice(0, -quote.length)))) return 'Crypto';
  return defaultCategory({symbol}) || 'Others';
}

export function buildMarketCatalogue(catalogue, configured) {
  const specifications = new Map(normalizeArrayResponse(configured).map(row => [name(row), row]));
  const result = new Map();
  for (const source of normalizeArrayResponse(catalogue)) {
    const symbol = name(source);
    if (!symbol) continue;
    const row = typeof source === 'string' ? {} : source;
    const config = specifications.get(symbol) || {};
    const supplied = String(row.category || row.Category || config.category || config.Category || '').trim();
    const category = supplied || inferMarketCategory(symbol);
    const canonical = [...marketCategories, 'Stocks', 'Futures', 'Bonds'].find(value => value.toLowerCase() === category.toLowerCase()) || category;
    result.set(symbol, { symbol, category: canonical });
  }
  return [...result.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function marketGroupCounts(symbols) {
  const counts = Object.fromEntries(marketCategories.map(category => [category, 0]));
  for (const row of symbols) {
    Object.defineProperty(counts, row.category, { value: (Object.hasOwn(counts, row.category) ? counts[row.category] : 0) + 1, enumerable: true, writable: true, configurable: true });
  }
  return counts;
}
