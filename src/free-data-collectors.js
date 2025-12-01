/**
 * Free Data Collectors for CryptoIntel System
 * All functions use FREE APIs with NO API keys required
 */

/**
 * Fetch data from CoinGecko Free API (no key required)
 */
export async function fetchCoinGeckoFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 30, 60000);
  const limitCheck = await rateLimiter.checkLimit('coingecko_free');

  if (!limitCheck.allowed) {
    console.log(`CoinGecko rate limit reached. Reset in ${limitCheck.resetIn}ms`);
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    // Fetch top 100 coins by market cap
    const marketsUrl = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h';
    const response = await fetch(marketsUrl);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const coins = await response.json();
    const signals = [];
    const marketData = [];

    for (const coin of coins) {
      // Store market data
      const marketId = `cg_${coin.id}_${Date.now()}`;
      marketData.push({
        id: marketId,
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        volume_24h: coin.total_volume,
        market_cap: coin.market_cap,
        price_change_24h: coin.price_change_percentage_24h,
        timestamp: Math.floor(Date.now() / 1000)
      });

      // Detect price alerts (>10% change)
      if (Math.abs(coin.price_change_percentage_24h) > 10) {
        signals.push({
          id: `signal_cg_${coin.id}_${Date.now()}`,
          source: 'coingecko',
          type: 'price_alert',
          entity: coin.symbol,
          data: JSON.stringify({
            price: coin.current_price,
            change_24h: coin.price_change_percentage_24h,
            volume: coin.total_volume,
            market_cap: coin.market_cap
          }),
          confidence_score: Math.min(Math.abs(coin.price_change_percentage_24h) / 20, 1),
          timestamp: Math.floor(Date.now() / 1000)
        });
      }

      // Detect volume anomalies
      if (coin.total_volume > coin.market_cap * 0.5) {
        signals.push({
          id: `signal_vol_${coin.id}_${Date.now()}`,
          source: 'coingecko',
          type: 'volume_anomaly',
          entity: coin.symbol,
          data: JSON.stringify({
            volume: coin.total_volume,
            market_cap: coin.market_cap,
            volume_ratio: coin.total_volume / coin.market_cap
          }),
          confidence_score: Math.min((coin.total_volume / coin.market_cap), 1),
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    }

    // Store data in D1
    for (const data of marketData) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(data.id, data.symbol, data.price, data.volume_24h, data.market_cap, data.price_change_24h, data.timestamp, 'coingecko').run();
    }

    for (const signal of signals) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
    }

    return { success: true, marketData: marketData.length, signals: signals.length };
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch DeFi data from DeFi Llama (completely free, no key needed)
 */
export async function fetchDeFiLlamaFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000);
  const limitCheck = await rateLimiter.checkLimit('defillama');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetch('https://api.llama.fi/protocols');
    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`);
    }

    const protocols = await response.json();
    const signals = [];

    // Get top 50 protocols by TVL
    const topProtocols = protocols
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 50);

    for (const protocol of topProtocols) {
      // Detect TVL anomalies (>20% change in 24h)
      if (protocol.change_1d && Math.abs(protocol.change_1d) > 20) {
        signals.push({
          id: `signal_defi_${protocol.slug}_${Date.now()}`,
          source: 'defillama',
          type: 'tvl_anomaly',
          entity: protocol.name,
          data: JSON.stringify({
            tvl: protocol.tvl,
            change_1d: protocol.change_1d,
            change_7d: protocol.change_7d,
            chains: protocol.chains,
            category: protocol.category
          }),
          confidence_score: Math.min(Math.abs(protocol.change_1d) / 30, 1),
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    }

    // Store signals in D1
    for (const signal of signals) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
    }

    return { success: true, protocols: topProtocols.length, signals: signals.length };
  } catch (error) {
    console.error('DeFi Llama fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch data from Binance Public API (no key required)
 */
export async function fetchBinanceFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000); // Conservative limit
  const limitCheck = await rateLimiter.checkLimit('binance_public');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    // Fetch 24hr ticker for all symbols
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const tickers = await response.json();
    const marketData = [];
    const signals = [];

    // Filter for USDT pairs and top volume
    const usdtPairs = tickers
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);

    for (const ticker of usdtPairs) {
      const symbol = ticker.symbol.replace('USDT', '');

      // Store market data
      marketData.push({
        id: `binance_${ticker.symbol}_${Date.now()}`,
        symbol: symbol,
        price: parseFloat(ticker.lastPrice),
        volume_24h: parseFloat(ticker.quoteVolume),
        price_change_24h: parseFloat(ticker.priceChangePercent),
        timestamp: Math.floor(Date.now() / 1000)
      });

      // Detect high volatility
      if (Math.abs(parseFloat(ticker.priceChangePercent)) > 15) {
        signals.push({
          id: `signal_binance_${ticker.symbol}_${Date.now()}`,
          source: 'binance',
          type: 'price_alert',
          entity: symbol,
          data: JSON.stringify({
            price: ticker.lastPrice,
            change_24h: ticker.priceChangePercent,
            volume: ticker.quoteVolume,
            high_24h: ticker.highPrice,
            low_24h: ticker.lowPrice
          }),
          confidence_score: Math.min(Math.abs(parseFloat(ticker.priceChangePercent)) / 20, 1),
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    }

    // Store in D1
    for (const data of marketData) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(data.id, data.symbol, data.price, data.volume_24h, data.price_change_24h, data.timestamp, 'binance').run();
    }

    for (const signal of signals) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
    }

    return { success: true, marketData: marketData.length, signals: signals.length };
  } catch (error) {
    console.error('Binance fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch data from CoinCap.io (no key required)
 */
export async function fetchCoinCapFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 200, 60000);
  const limitCheck = await rateLimiter.checkLimit('coincap');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetch('https://api.coincap.io/v2/assets?limit=100');
    if (!response.ok) {
      throw new Error(`CoinCap API error: ${response.status}`);
    }

    const result = await response.json();
    const assets = result.data;
    const marketData = [];

    for (const asset of assets.slice(0, 50)) { // Top 50 by rank
      marketData.push({
        id: `coincap_${asset.id}_${Date.now()}`,
        symbol: asset.symbol,
        price: parseFloat(asset.priceUsd),
        volume_24h: parseFloat(asset.volumeUsd24Hr),
        market_cap: parseFloat(asset.marketCapUsd),
        price_change_24h: parseFloat(asset.changePercent24Hr),
        timestamp: Math.floor(Date.now() / 1000)
      });
    }

    // Store in D1 (use as backup data source)
    for (const data of marketData) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(data.id, data.symbol, data.price, data.volume_24h, data.market_cap, data.price_change_24h, data.timestamp, 'coincap').run();
    }

    return { success: true, marketData: marketData.length };
  } catch (error) {
    console.error('CoinCap fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch news from CryptoPanic RSS (no key required)
 */
export async function fetchCryptoPanicRSS(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 60, 60000);
  const limitCheck = await rateLimiter.checkLimit('cryptopanic_rss');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetch('https://cryptopanic.com/news/rss?filter=hot');
    if (!response.ok) {
      throw new Error(`CryptoPanic RSS error: ${response.status}`);
    }

    const rssText = await response.text();
    const signals = [];

    // Simple RSS parsing
    const items = rssText.match(/<item>(.*?)<\/item>/gs) || [];

    for (const item of items.slice(0, 20)) { // Process top 20 news items
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) || [])[1] || '';
      const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';

      // Simple sentiment analysis
      const bullishKeywords = ['surge', 'rally', 'bullish', 'gains', 'breakthrough', 'adoption', 'soar', 'jump', 'rise'];
      const bearishKeywords = ['crash', 'plunge', 'bearish', 'falls', 'dump', 'concerns', 'regulatory', 'ban', 'drop'];

      const text = `${title} ${description}`.toLowerCase();
      const bullishScore = bullishKeywords.filter(k => text.includes(k)).length;
      const bearishScore = bearishKeywords.filter(k => text.includes(k)).length;

      // Extract mentioned entities
      const entities = [];
      const cryptoRegex = /\b(bitcoin|btc|ethereum|eth|bnb|xrp|cardano|ada|solana|sol|dogecoin|doge)\b/gi;
      const matches = text.match(cryptoRegex);
      if (matches) {
        entities.push(...new Set(matches.map(m => m.toUpperCase())));
      }

      if (bullishScore !== bearishScore && entities.length > 0) {
        const sentiment = bullishScore > bearishScore ? 'bullish' : 'bearish';
        const sentimentScore = bullishScore > bearishScore ? bullishScore : -bearishScore;

        signals.push({
          id: `signal_news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'cryptopanic',
          type: 'sentiment_shift',
          entity: entities[0], // Primary entity
          data: JSON.stringify({
            title: title.slice(0, 200),
            sentiment: sentiment,
            sentiment_score: sentimentScore,
            entities: entities,
            keywords: bullishScore > bearishScore ?
              bullishKeywords.filter(k => text.includes(k)) :
              bearishKeywords.filter(k => text.includes(k))
          }),
          confidence_score: Math.min(Math.abs(sentimentScore) / 3, 1),
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    }

    // Store signals
    for (const signal of signals) {
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
    }

    return { success: true, newsItems: items.length, signals: signals.length };
  } catch (error) {
    console.error('CryptoPanic fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rate Limiter class
 */
class RateLimiter {
  constructor(kv, limit = 30, window = 60000) {
    this.kv = kv;
    this.limit = limit;
    this.window = window;
  }

  async checkLimit(key) {
    const now = Date.now();
    const windowKey = `rate_limit:${key}:${Math.floor(now / this.window)}`;

    const count = await this.kv.get(windowKey) || 0;

    if (count >= this.limit) {
      const resetTime = Math.ceil(now / this.window) * this.window;
      return {
        allowed: false,
        remaining: 0,
        resetIn: resetTime - now
      };
    }

    await this.kv.put(windowKey, parseInt(count) + 1, {
      expirationTtl: Math.ceil(this.window / 1000)
    });

    return {
      allowed: true,
      remaining: this.limit - count - 1
    };
  }
}

/**
 * Collect data from all free sources
 */
export async function collectFreeData(env) {
  console.log('Starting free data collection...');
  const results = [];

  // Collect from all sources with proper error handling
  try {
    console.log('Fetching from CoinGecko...');
    const cgResult = await fetchCoinGeckoFree(env);
    results.push({ source: 'CoinGecko', ...cgResult });
  } catch (error) {
    console.error('CoinGecko error:', error);
    results.push({ source: 'CoinGecko', success: false, error: error.message });
  }

  try {
    console.log('Fetching from DeFi Llama...');
    const defiResult = await fetchDeFiLlamaFree(env);
    results.push({ source: 'DeFi Llama', ...defiResult });
  } catch (error) {
    console.error('DeFi Llama error:', error);
    results.push({ source: 'DeFi Llama', success: false, error: error.message });
  }

  try {
    console.log('Fetching from Binance...');
    const binanceResult = await fetchBinanceFree(env);
    results.push({ source: 'Binance', ...binanceResult });
  } catch (error) {
    console.error('Binance error:', error);
    results.push({ source: 'Binance', success: false, error: error.message });
  }

  try {
    console.log('Fetching from CoinCap...');
    const coincapResult = await fetchCoinCapFree(env);
    results.push({ source: 'CoinCap', ...coincapResult });
  } catch (error) {
    console.error('CoinCap error:', error);
    results.push({ source: 'CoinCap', success: false, error: error.message });
  }

  try {
    console.log('Fetching from CryptoPanic...');
    const newsResult = await fetchCryptoPanicRSS(env);
    results.push({ source: 'CryptoPanic', ...newsResult });
  } catch (error) {
    console.error('CryptoPanic error:', error);
    results.push({ source: 'CryptoPanic', success: false, error: error.message });
  }

  // Log collection summary
  const summary = {
    timestamp: new Date().toISOString(),
    sources: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalSignals: results.reduce((sum, r) => sum + (r.signals || 0), 0),
    totalMarketData: results.reduce((sum, r) => sum + (r.marketData || 0), 0),
    results: results
  };

  console.log('Free data collection summary:', JSON.stringify(summary, null, 2));
  return summary;
}