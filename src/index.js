/**
 * CryptoIntel Data Gathering System
 * Multi-source crypto intelligence data collection and analysis
 * Integrates with x402 ecosystem for monetization
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import dashboard from './dashboard.js';
import intelligenceDashboard from './intelligence-dashboard.js';
import enhancedDashboard from './enhanced-dashboard.js';

const app = new Hono();

// CORS configuration for x402 integration
app.use('/*', cors({
  origin: ['https://x402-ecosystem.workers.dev', 'https://tools-x402-production.magicmike.workers.dev'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-x402-signature'],
}));

/**
 * FREE Data source configurations (NO API KEYS REQUIRED)
 */
function getFreeDataSources() {
  return {
    coingecko_free: {
      name: 'CoinGecko Free',
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: { requests: 30, window: 60000 }, // 30 calls per minute
      endpoints: {
        simplePrice: '/simple/price',
        coinsList: '/coins/list',
        coinsMarkets: '/coins/markets'
      }
    },
    defillama: {
      name: 'DeFi Llama',
      baseUrl: 'https://api.llama.fi',
      rateLimit: { requests: 100, window: 60000 }, // 100+ calls per minute
      endpoints: {
        protocols: '/protocols',
        tvl: '/tvl',
        chains: '/v2/chains'
      }
    },
    binance_public: {
      name: 'Binance Public',
      baseUrl: 'https://api.binance.com/api/v3',
      rateLimit: { requests: 1200, window: 60000 }, // 1200 weight per minute
      endpoints: {
        ticker24hr: '/ticker/24hr',
        tickerPrice: '/ticker/price',
        avgPrice: '/avgPrice'
      }
    },
    coincap: {
      name: 'CoinCap',
      baseUrl: 'https://api.coincap.io/v2',
      rateLimit: { requests: 200, window: 60000 }, // 200 requests per minute
      endpoints: {
        assets: '/assets',
        rates: '/rates'
      }
    },
    kraken_public: {
      name: 'Kraken Public',
      baseUrl: 'https://api.kraken.com/0/public',
      rateLimit: { requests: 900, window: 60000 }, // 15 calls per second = 900/min
      endpoints: {
        ticker: '/Ticker',
        ohlc: '/OHLC'
      }
    },
    cryptopanic_rss: {
      name: 'CryptoPanic RSS',
      rssUrl: 'https://cryptopanic.com/news/rss',
      rateLimit: { requests: 60, window: 60000 } // 60 calls per minute
    }
  };
}

/**
 * Database schema for signal storage
 */
const SCHEMA = {
  signals: `
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      entity TEXT NOT NULL,
      data TEXT NOT NULL,
      confidence_score REAL DEFAULT 0.0,
      timestamp INTEGER NOT NULL,
      processed BOOLEAN DEFAULT FALSE
    );
  `,
  market_data: `
    CREATE TABLE IF NOT EXISTS market_data (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      price REAL,
      volume_24h REAL,
      market_cap REAL,
      price_change_24h REAL,
      timestamp INTEGER NOT NULL
    );
  `,
  entity_mentions: `
    CREATE TABLE IF NOT EXISTS entity_mentions (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      mention_count INTEGER DEFAULT 1,
      sentiment_score REAL DEFAULT 0.0,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (signal_id) REFERENCES signals(id)
    );
  `
};

/**
 * Initialize database schema
 */
async function initializeDatabase(env) {
  try {
    await env.CRYPTOINTEL_DB.exec(SCHEMA.signals);
    await env.CRYPTOINTEL_DB.exec(SCHEMA.market_data);
    await env.CRYPTOINTEL_DB.exec(SCHEMA.entity_mentions);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Rate limiting helper
 */
class RateLimiter {
  constructor(kv, limit = 30, window = 60000) { // 30 requests per minute
    this.kv = kv;
    this.limit = limit;
    this.window = window;
  }

  async checkLimit(key) {
    const now = Date.now();
    const windowStart = now - this.window;
    
    const current = await this.kv.get(`rate_limit:${key}:${Math.floor(now / this.window)}`);
    const count = current ? parseInt(current) : 0;
    
    if (count >= this.limit) {
      return { allowed: false, resetTime: windowStart + this.window };
    }
    
    await this.kv.put(`rate_limit:${key}:${Math.floor(now / this.window)}`, (count + 1).toString(), {
      expirationTtl: this.window / 1000
    });
    
    return { allowed: true, remaining: this.limit - count - 1 };
  }
}

/**
 * Detect volume and price anomaly signals from market data
 */
async function detectMarketSignals(env, marketData, source) {
  const signals = [];

  try {
    // Get historical data for comparison
    const historicalResult = await env.CRYPTOINTEL_DB.prepare(`
      SELECT AVG(volume_24h) as avg_volume, AVG(ABS(price_change_24h)) as avg_volatility
      FROM market_data
      WHERE symbol = ? AND timestamp > ?
    `).bind(marketData.symbol, Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)).first();

    // Volume anomaly detection (volume > 2x average)
    if (historicalResult && historicalResult.avg_volume && marketData.volume_24h > historicalResult.avg_volume * 2) {
      const signal = {
        id: `volume_${source}_${marketData.symbol}_${Date.now()}`,
        source: source,
        type: 'volume_anomaly',
        entity: marketData.symbol.toLowerCase(),
        data: JSON.stringify({
          current_volume: marketData.volume_24h,
          average_volume: historicalResult.avg_volume,
          volume_ratio: marketData.volume_24h / historicalResult.avg_volume,
          price: marketData.price,
          price_change_24h: marketData.price_change_24h
        }),
        confidence_score: Math.min(0.9, (marketData.volume_24h / historicalResult.avg_volume) / 5),
        timestamp: Math.floor(Date.now() / 1000),
        processed: false
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.id,
        signal.source,
        signal.type,
        signal.entity,
        signal.data,
        signal.confidence_score,
        signal.timestamp,
        signal.processed ? 1 : 0
      ).run();

      signals.push(signal);
    }

    // Price alert detection (significant price movement > 10%)
    if (Math.abs(marketData.price_change_24h) > 10) {
      const signal = {
        id: `price_${source}_${marketData.symbol}_${Date.now()}`,
        source: source,
        type: 'price_alert',
        entity: marketData.symbol.toLowerCase(),
        data: JSON.stringify({
          price: marketData.price,
          price_change_24h: marketData.price_change_24h,
          volume_24h: marketData.volume_24h,
          market_cap: marketData.market_cap,
          direction: marketData.price_change_24h > 0 ? 'up' : 'down'
        }),
        confidence_score: Math.min(0.95, Math.abs(marketData.price_change_24h) / 20),
        timestamp: Math.floor(Date.now() / 1000),
        processed: false
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.id,
        signal.source,
        signal.type,
        signal.entity,
        signal.data,
        signal.confidence_score,
        signal.timestamp,
        signal.processed ? 1 : 0
      ).run();

      signals.push(signal);
    }
  } catch (error) {
    console.error(`Error detecting market signals for ${marketData.symbol}:`, error);
  }

  return signals;
}

/**
 * CoinGecko Free API integration (NO API KEY)
 */
async function fetchCoinGeckoFree(env, symbols = ['bitcoin', 'ethereum', 'solana']) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 30, 60000);
  const limitCheck = await rateLimiter.checkLimit('coingecko_free');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  const results = [];

  try {
    // Use /coins/markets endpoint for batch data
    const url = `${dataSources.coingecko_free.baseUrl}/coins/markets?vs_currency=usd&ids=${symbols.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`CoinGecko Free API error:`, response.status);
      return { source: 'coingecko_free', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();

    for (const coin of data) {
      const marketData = {
        id: `cgfree_${coin.id}_${Date.now()}`,
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price || 0,
        volume_24h: coin.total_volume || 0,
        market_cap: coin.market_cap || 0,
        price_change_24h: coin.price_change_percentage_24h || 0,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        marketData.id,
        marketData.symbol,
        marketData.price,
        marketData.volume_24h,
        marketData.market_cap,
        marketData.price_change_24h,
        marketData.timestamp,
        'coingecko_free'
      ).run();

      results.push(marketData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`market_data:${coin.id}`, JSON.stringify(marketData), {
        expirationTtl: 300
      });

      // Detect market signals
      await detectMarketSignals(env, marketData, 'coingecko_free');
    }

  } catch (error) {
    console.error(`Error fetching CoinGecko Free data:`, error);
    return { source: 'coingecko_free', data: [], error: error.message };
  }

  return { source: 'coingecko_free', data: results, cached: false };
}

/**
 * Binance Public API integration (NO API KEY)
 */
async function fetchBinanceFree(env, symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 1200, 60000);
  const limitCheck = await rateLimiter.checkLimit('binance_public');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  const results = [];

  try {
    // Use /ticker/24hr endpoint for batch data
    const url = `${dataSources.binance_public.baseUrl}/ticker/24hr`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`Binance Public API error:`, response.status);
      return { source: 'binance_public', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();

    // Filter for requested symbols
    const filteredData = data.filter(ticker => symbols.includes(ticker.symbol));

    for (const ticker of filteredData) {
      const marketData = {
        id: `binance_${ticker.symbol}_${Date.now()}`,
        symbol: ticker.symbol.replace('USDT', '').toUpperCase(),
        price: parseFloat(ticker.lastPrice) || 0,
        volume_24h: parseFloat(ticker.quoteVolume) || 0,
        market_cap: 0, // Binance doesn't provide market cap
        price_change_24h: parseFloat(ticker.priceChangePercent) || 0,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        marketData.id,
        marketData.symbol,
        marketData.price,
        marketData.volume_24h,
        marketData.market_cap,
        marketData.price_change_24h,
        marketData.timestamp,
        'binance_public'
      ).run();

      results.push(marketData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`market_data:binance_${ticker.symbol}`, JSON.stringify(marketData), {
        expirationTtl: 300
      });

      // Detect market signals
      await detectMarketSignals(env, marketData, 'binance_public');
    }

  } catch (error) {
    console.error(`Error fetching Binance Free data:`, error);
    return { source: 'binance_public', data: [], error: error.message };
  }

  return { source: 'binance_public', data: results, cached: false };
}

/**
 * CoinCap API integration (NO API KEY)
 */
async function fetchCoinCapFree(env, symbols = ['bitcoin', 'ethereum', 'solana']) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 200, 60000);
  const limitCheck = await rateLimiter.checkLimit('coincap_free');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  const results = [];

  try {
    // Fetch all assets and filter for requested symbols
    const url = `${dataSources.coincap.baseUrl}/assets`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`CoinCap API error:`, response.status);
      return { source: 'coincap', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const assets = data.data || [];

    // Filter for requested symbols
    const filteredAssets = assets.filter(asset =>
      symbols.includes(asset.id.toLowerCase()) || symbols.includes(asset.symbol.toLowerCase())
    );

    for (const asset of filteredAssets) {
      const marketData = {
        id: `coincap_${asset.id}_${Date.now()}`,
        symbol: asset.symbol.toUpperCase(),
        price: parseFloat(asset.priceUsd) || 0,
        volume_24h: parseFloat(asset.volumeUsd24Hr) || 0,
        market_cap: parseFloat(asset.marketCapUsd) || 0,
        price_change_24h: parseFloat(asset.changePercent24Hr) || 0,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        marketData.id,
        marketData.symbol,
        marketData.price,
        marketData.volume_24h,
        marketData.market_cap,
        marketData.price_change_24h,
        marketData.timestamp,
        'coincap'
      ).run();

      results.push(marketData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`market_data:coincap_${asset.id}`, JSON.stringify(marketData), {
        expirationTtl: 300
      });

      // Detect market signals
      await detectMarketSignals(env, marketData, 'coincap');
    }

  } catch (error) {
    console.error(`Error fetching CoinCap Free data:`, error);
    return { source: 'coincap', data: [], error: error.message };
  }

  return { source: 'coincap', data: results, cached: false };
}

/**
 * Kraken Public API integration (NO API KEY)
 */
async function fetchKrakenFree(env, pairs = ['XXBTZUSD', 'XETHZUSD', 'SOLUSD']) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 900, 60000);
  const limitCheck = await rateLimiter.checkLimit('kraken_public');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  const results = [];

  try {
    // Use /Ticker endpoint for batch data
    const url = `${dataSources.kraken_public.baseUrl}/Ticker?pair=${pairs.join(',')}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`Kraken Public API error:`, response.status);
      return { source: 'kraken_public', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();

    if (data.error && data.error.length > 0) {
      console.warn(`Kraken API returned errors:`, data.error);
      return { source: 'kraken_public', data: [], error: data.error.join(', ') };
    }

    const result = data.result || {};

    for (const [pairKey, ticker] of Object.entries(result)) {
      // Extract symbol from pair key (e.g., XXBTZUSD -> BTC)
      let symbol = pairKey.replace('XXBT', 'BTC').replace('XETH', 'ETH').replace('ZUSD', '').replace('USD', '');

      const currentPrice = parseFloat(ticker.c?.[0]) || 0;
      const volume24h = parseFloat(ticker.v?.[1]) || 0;
      const priceChange24h = ((parseFloat(ticker.c?.[0]) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100 || 0;

      const marketData = {
        id: `kraken_${pairKey}_${Date.now()}`,
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        volume_24h: volume24h * currentPrice, // Convert to USD volume
        market_cap: 0, // Kraken doesn't provide market cap
        price_change_24h: priceChange24h,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        marketData.id,
        marketData.symbol,
        marketData.price,
        marketData.volume_24h,
        marketData.market_cap,
        marketData.price_change_24h,
        marketData.timestamp,
        'kraken_public'
      ).run();

      results.push(marketData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`market_data:kraken_${symbol}`, JSON.stringify(marketData), {
        expirationTtl: 300
      });

      // Detect market signals
      await detectMarketSignals(env, marketData, 'kraken_public');
    }

  } catch (error) {
    console.error(`Error fetching Kraken Free data:`, error);
    return { source: 'kraken_public', data: [], error: error.message };
  }

  return { source: 'kraken_public', data: results, cached: false };
}

/**
 * DeFi Llama Free API integration (NO API KEY)
 */
async function fetchDeFiLlamaFree(env) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000);
  const limitCheck = await rateLimiter.checkLimit('defillama_free');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const url = `${dataSources.defillama.baseUrl}/protocols`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn('DeFi Llama Free API error:', response.status);
      return { source: 'defillama', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();

    // Handle both array and object responses
    let protocols = [];
    if (Array.isArray(data)) {
      protocols = data;
    } else if (data.protocols && Array.isArray(data.protocols)) {
      protocols = data.protocols;
    } else {
      console.warn('DeFi Llama returned unexpected data format');
      return { source: 'defillama', data: [], error: 'Unexpected data format' };
    }

    // Look for high TVL protocols and unusual activity
    const signals = [];

    for (const protocol of protocols.slice(0, 20)) { // Limit to top 20
      const tvlChange = calculateTVLChange(protocol);
      if (tvlChange.unusual) {
        const signal = {
          id: `defi_${protocol.name || protocol.slug}_${Date.now()}`,
          source: 'defillama',
          type: 'tvl_anomaly',
          entity: protocol.name || protocol.slug || 'unknown',
          data: JSON.stringify({
            current_tvl: protocol.tvl || 0,
            tvl_change_24h: tvlChange.percentChange,
            chains: protocol.chains || [],
            category: protocol.category || 'unknown'
          }),
          confidence_score: Math.min(0.9, Math.abs(tvlChange.percentChange) / 50),
          timestamp: Math.floor(Date.now() / 1000),
          processed: false
        };

        await env.CRYPTOINTEL_DB.prepare(`
          INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          signal.id,
          signal.source,
          signal.type,
          signal.entity,
          signal.data,
          signal.confidence_score,
          signal.timestamp,
          signal.processed ? 1 : 0
        ).run();

        signals.push(signal);
      }
    }

    return { source: 'defillama', data: signals, cached: false };

  } catch (error) {
    console.error('Error fetching DeFi Llama Free data:', error);
    return { source: 'defillama', data: [], error: error.message };
  }
}

/**
 * Calculate TVL change for anomaly detection
 */
function calculateTVLChange(protocol) {
  if (!protocol.tvl || !protocol.historical_tvl) {
    return { unusual: false, percentChange: 0 };
  }
  
  const currentTVL = parseFloat(protocol.tvl);
  const historicalTVL = parseFloat(protocol.historical_tvl);
  const percentChange = ((currentTVL - historicalTVL) / historicalTVL) * 100;
  
  // Consider unusual if change > 20% in either direction
  return {
    unusual: Math.abs(percentChange) > 20,
    percentChange: percentChange
  };
}

/**
 * CryptoPanic RSS feed processing (NO API KEY)
 */
async function fetchCryptoPanicRSS(env) {
  const dataSources = getFreeDataSources();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 60, 60000);
  const limitCheck = await rateLimiter.checkLimit('cryptopanic_rss');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const response = await fetch(dataSources.cryptopanic_rss.rssUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'CryptoIntel-Data/1.0'
      }
    });

    if (!response.ok) {
      console.warn('CryptoPanic RSS error:', response.status);
      return { source: 'cryptopanic_rss', data: [], error: `RSS fetch failed: ${response.status}` };
    }

    const rssText = await response.text();
    const newsItems = parseRSSFeed(rssText);

    const signals = [];

    for (const item of newsItems.slice(0, 10)) { // Process top 10 news items
      const sentiment = analyzeSentiment(item.title + ' ' + item.description);

      const signal = {
        id: `news_${item.guid || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: 'cryptopanic_rss',
        type: 'sentiment_shift',
        entity: extractEntities(item.title + ' ' + item.description),
        data: JSON.stringify({
          title: item.title,
          description: item.description,
          url: item.link,
          published_date: item.pubDate,
          sentiment_score: sentiment.score,
          keywords: sentiment.keywords
        }),
        confidence_score: Math.min(0.8, sentiment.confidence),
        timestamp: Math.floor(Date.now() / 1000),
        processed: false
      };

      await env.CRYPTOINTEL_DB.prepare(`
        INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.id,
        signal.source,
        signal.type,
        signal.entity,
        signal.data,
        signal.confidence_score,
        signal.timestamp,
        signal.processed ? 1 : 0
      ).run();

      signals.push(signal);
    }

    return { source: 'cryptopanic_rss', data: signals, cached: false };

  } catch (error) {
    console.error('Error fetching CryptoPanic RSS:', error);
    return { source: 'cryptopanic_rss', data: [], error: error.message };
  }
}

/**
 * Simple RSS feed parser
 */
function parseRSSFeed(rssText) {
  const items = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;

  const matches = rssText.match(itemRegex);

  if (matches) {
    for (const match of matches) {
      const itemContent = match;
      items.push({
        title: extractValue(/<title>(.*?)<\/title>/s, itemContent),
        link: extractValue(/<link>(.*?)<\/link>/s, itemContent),
        description: extractValue(/<description>(.*?)<\/description>/s, itemContent),
        guid: extractValue(/<guid>(.*?)<\/guid>/s, itemContent),
        pubDate: extractValue(/<pubDate>(.*?)<\/pubDate>/s, itemContent)
      });
    }
  }

  return items;
}

function extractValue(regex, content) {
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text) {
  const positiveWords = ['bullish', 'surge', 'rally', 'breakout', 'adoption', 'growth', 'milestone'];
  const negativeWords = ['bearish', 'crash', 'decline', 'fall', 'dump', 'crisis', 'concern'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  const keywords = [];
  
  for (const word of positiveWords) {
    if (lowerText.includes(word)) {
      score += 1;
      keywords.push(word);
    }
  }
  
  for (const word of negativeWords) {
    if (lowerText.includes(word)) {
      score -= 1;
      keywords.push(word);
    }
  }
  
  const confidence = Math.min(0.9, Math.abs(score) / 5);
  
  return {
    score: keywords.length > 0 ? score / keywords.length : 0,
    confidence: confidence,
    keywords: [...new Set(keywords)]
  };
}

/**
 * Extract entities (tokens, exchanges, wallets) from text
 */
function extractEntities(text) {
  const commonTokens = ['bitcoin', 'ethereum', 'btc', 'eth', 'solana', 'cardano', 'polkadot', 'avalanche'];
  const exchanges = ['binance', 'coinbase', 'kraken', 'uniswap', 'pancakeswap'];
  
  const entities = [];
  const lowerText = text.toLowerCase();
  
  for (const token of commonTokens) {
    if (lowerText.includes(token)) {
      entities.push({ type: 'token', name: token });
    }
  }
  
  for (const exchange of exchanges) {
    if (lowerText.includes(exchange)) {
      entities.push({ type: 'exchange', name: exchange });
    }
  }
  
  // Simple wallet address detection (regex for ETH-like addresses)
  const walletRegex = /0x[a-fA-F0-9]{40}/g;
  const wallets = lowerText.match(walletRegex) || [];
  
  for (const wallet of wallets) {
    entities.push({ type: 'wallet', name: wallet });
  }
  
  return entities.map(e => e.name).join(', ');
}

/**
 * API Routes
 */

// Health check
app.get('/health', async (c) => {
  const dataSources = getFreeDataSources();
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-free',
    cost: '$0/month',
    sources: Object.keys(dataSources),
    message: 'All data sources are FREE - no API keys required'
  });
});

// Get cached market data
app.get('/market-data/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const cached = await c.env.CRYPTOINTEL_CACHE.get(`market_data:${symbol}`);
  
  if (cached) {
    return c.json(JSON.parse(cached), { headers: { 'X-Cache': 'HIT' } });
  }
  
  return c.json({ error: 'Data not cached' }, { status: 404 });
});
// Mount dashboard routes
app.route('/dashboard', dashboard);
app.route('/intelligence', intelligenceDashboard);
app.route('/enhanced-dashboard', enhancedDashboard);

// DEX endpoints removed - CoinMarketCap API key required (not free)
// All data now comes from FREE sources only

// Collect data from all FREE sources (NO API KEYS)
app.post('/collect', async (c) => {
  const results = {};

  try {
    // Initialize database if needed
    await initializeDatabase(c.env);
    await initializeTransactionsTable(c.env.CRYPTOINTEL_DB);

    console.log('Starting FREE data collection from all sources...');

    // Collect from CoinGecko Free
    const cgData = await fetchCoinGeckoFree(c.env, ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']);
    results.coingecko_free = cgData;

    // Collect from Binance Public
    const binanceData = await fetchBinanceFree(c.env, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT']);
    results.binance_public = binanceData;

    // Collect from CoinCap
    const coincapData = await fetchCoinCapFree(c.env, ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']);
    results.coincap = coincapData;

    // Collect from Kraken Public
    const krakenData = await fetchKrakenFree(c.env, ['XXBTZUSD', 'XETHZUSD', 'SOLUSD', 'ADAUSD', 'DOTUSD']);
    results.kraken_public = krakenData;

    // Collect from DeFi Llama
    const defiData = await fetchDeFiLlamaFree(c.env);
    results.defillama = defiData;

    // Collect from CryptoPanic RSS
    const newsData = await fetchCryptoPanicRSS(c.env);
    results.cryptopanic_rss = newsData;

    // Store entity mentions
    for (const [source, data] of Object.entries(results)) {
      if (data.data && Array.isArray(data.data)) {
        for (const signal of data.data) {
          if (signal.entity) {
            const entities = signal.entity.split(', ').filter(e => e.length > 0);

            for (const entity of entities) {
              await c.env.CRYPTOINTEL_DB.prepare(`
                INSERT OR REPLACE INTO entity_mentions (id, signal_id, entity_type, entity_name, mention_count, sentiment_score, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).bind(
                `${source}_${entity}_${Date.now()}`,
                signal.id,
                'token', // Default to token type, could be enhanced
                entity,
                1,
                signal.confidence_score || 0.5,
                signal.timestamp
              ).run();
            }
          }
        }
      }
    }

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      cost: '$0',
      api_keys_used: 0,
      results: {
        collected: Object.keys(results).length,
        signals: Object.values(results).reduce((sum, r) => sum + (r.data?.length || 0), 0),
        sources: results
      }
    });

  } catch (error) {
    console.error('Data collection error:', error);
    return c.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

// Get signals for x402 integration
app.get('/signals', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const type = c.req.query('type');
    const entity = c.req.query('entity');
    
    let query = 'SELECT * FROM signals WHERE processed = FALSE';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (entity) {
      query += ' AND entity LIKE ?';
      params.push(`%${entity}%`);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    const signals = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();
    
    return c.json({
      signals: signals,
      count: signals.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Signals query error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

// Get market data for analysis
app.get('/market-analysis', async (c) => {
  try {
    const symbols = (c.req.query('symbols') || 'bitcoin,ethereum').split(',');
    
    const analysis = [];
    
    for (const symbol of symbols) {
      const cached = await c.env.CRYPTOINTEL_CACHE.get(`market_data:${symbol.trim()}`);
      
      if (cached) {
        const data = JSON.parse(cached);
        analysis.push({
          symbol: data.symbol,
          price: data.price,
          volume_24h: data.volume_24h,
          market_cap: data.market_cap,
          price_change_24h: data.price_change_24h,
          trend: data.price_change_24h > 0 ? 'bullish' : 'bearish'
        });
      }
    }
    
    return c.json({
      analysis: analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Market analysis error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

// x402 integration endpoint for paid analysis
app.post('/x402/analysis', async (c) => {
  try {
    // Verify x402 payment (simplified for now)
    const paymentData = await c.req.json();

    if (!paymentData || !paymentData.transactionId) {
      return c.json({ error: 'Payment verification required' }, { status: 402 });
    }

    // Check if transaction ID has already been used (replay protection)
    const existingTransaction = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT id FROM transactions WHERE id = ?
    `).bind(paymentData.transactionId).first();

    if (existingTransaction) {
      return c.json({
        error: 'Transaction already processed',
        transactionId: paymentData.transactionId
      }, { status: 409 });
    }

    // Generate comprehensive analysis report
    const report = await generateAnalysisReport(c.env, paymentData);
    
    // Log transaction for intelligence system
    await logTransaction(c.env.CRYPTOINTEL_DB, {
      transaction_id: paymentData.transactionId,
      tool_id: 'cryptointel-analysis',
      user_wallet: paymentData.wallet || 'unknown',
      amount: paymentData.amount || 0.001,
      currency: 'ETH',
      status: 'confirmed',
      metadata: JSON.stringify({
        report_type: paymentData.reportType || 'comprehensive',
        data_points: report.dataPoints,
        generated_at: new Date().toISOString()
      })
    });
    
    return c.json({
      success: true,
      report: report,
      transactionId: paymentData.transactionId
    });
    
  } catch (error) {
    console.error('x402 analysis error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate comprehensive analysis report
 */
async function generateAnalysisReport(env, paymentData) {
  const reportType = paymentData.reportType || 'comprehensive';
  const timeRange = paymentData.timeRange || '24h';

  // Get recent signals
  const signals = await env.CRYPTOINTEL_DB.prepare(`
    SELECT * FROM signals
    WHERE timestamp > ?
    ORDER BY confidence_score DESC, timestamp DESC
    LIMIT 20
  `).bind(Math.floor(Date.now() / 1000) - (24 * 60 * 60)).all();

  // Get market data
  const marketData = await env.CRYPTOINTEL_DB.prepare(`
    SELECT * FROM market_data
    WHERE timestamp > ?
    ORDER BY timestamp DESC
    LIMIT 10
  `).bind(Math.floor(Date.now() / 1000) - (24 * 60 * 60)).all();
  
  // Generate insights
  const signalResults = signals.results || [];
  const marketResults = marketData.results || [];

  const insights = {
    sentiment_shifts: signalResults.filter(s => s.type === 'sentiment_shift'),
    volume_anomalies: signalResults.filter(s => s.type === 'volume_anomaly'),
    tvl_changes: signalResults.filter(s => s.type === 'tvl_anomaly'),
    market_trends: analyzeMarketTrends(marketResults),
    key_entities: extractKeyEntities(signalResults)
  };

  return {
    type: reportType,
    timeRange: timeRange,
    generatedAt: new Date().toISOString(),
    dataPoints: signalResults.length + marketResults.length,
    insights: insights,
    signals: signalResults.slice(0, 10), // Top 10 signals
    marketData: marketResults.slice(0, 5) // Top 5 market data points
  };
}

function analyzeMarketTrends(marketData) {
  const btc = marketData.find(d => d.symbol === 'BTC');
  const eth = marketData.find(d => d.symbol === 'ETH');
  
  return {
    btc_eth_correlation: btc && eth ? calculateCorrelation(btc.price_change_24h, eth.price_change_24h) : 0,
    overall_market_sentiment: marketData.filter(d => d.price_change_24h > 0).length > marketData.length / 2 ? 'bullish' : 'bearish',
    volatility_index: calculateVolatilityIndex(marketData)
  };
}

// Get transaction intelligence
app.get('/x402/transactions', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const toolId = c.req.query('tool_id');
    
    let query = 'SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?';
    let params = [limit];
    
    if (toolId) {
      query = 'SELECT * FROM transactions WHERE tool_id = ? ORDER BY timestamp DESC LIMIT ?';
      params = [toolId, limit];
    }
    
    const transactions = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();
    
    return c.json({
      transactions: transactions,
      count: transactions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Transaction query error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

// Get transaction analytics
app.get('/x402/analytics', async (c) => {
  try {
    // Revenue by tool
    const revenueByTool = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT tool_id, SUM(amount) as total_revenue, COUNT(*) as transaction_count
      FROM transactions 
      WHERE status = 'confirmed'
      GROUP BY tool_id
      ORDER BY total_revenue DESC
    `).all();
    
    // Daily revenue trend
    const dailyRevenue = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT DATE(datetime(timestamp, 'unixepoch')) as date, 
             SUM(amount) as daily_revenue, 
             COUNT(*) as daily_transactions
      FROM transactions 
      WHERE status = 'confirmed' AND timestamp > ?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `).bind(Date.now() - (30 * 24 * 60 * 60 * 1000)).all();
    
    // Top users by spending
    const topUsers = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT user_wallet, SUM(amount) as total_spent, COUNT(*) as transaction_count
      FROM transactions 
      WHERE status = 'confirmed'
      GROUP BY user_wallet
      ORDER BY total_spent DESC
      LIMIT 10
    `).all();
    
    return c.json({
      revenue_by_tool: revenueByTool,
      daily_revenue: dailyRevenue,
      top_users: topUsers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics query error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

function calculateCorrelation(x, y) {
  return x && y ? (x * y) / Math.abs(x * y) : 0;
}

function calculateVolatilityIndex(marketData) {
  const changes = marketData.map(d => Math.abs(d.price_change_24h));
  const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
  return avgChange;
}

function extractKeyEntities(signals) {
  const entityCount = {};
  
  for (const signal of signals) {
    if (signal.entity) {
      const entities = signal.entity.split(', ');
      for (const entity of entities) {
        entityCount[entity] = (entityCount[entity] || 0) + 1;
      }
    }
  }
  
  return Object.entries(entityCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([entity, count]) => ({ entity, count }));
}

/**
 * Log transaction for intelligence tracking
 */
async function logTransaction(db, transactionData) {
  const txId = transactionData.transaction_id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.prepare(`
    INSERT INTO transactions (id, tool_id, user_wallet, amount, currency, status, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    txId,
    transactionData.tool_id,
    transactionData.user_wallet,
    transactionData.amount,
    transactionData.currency,
    transactionData.status,
    Math.floor(Date.now() / 1000),
    transactionData.metadata
  ).run();
}

/**
 * Initialize transactions table for x402 intelligence tracking
 */
async function initializeTransactionsTable(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        user_wallet TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
    `);
    console.log('Transactions table initialized successfully');
  } catch (error) {
    console.error('Transactions table initialization failed:', error);
    throw error;
  }
}

// DEX functions removed - CoinMarketCap API key required (not free)
// All DEX data collection has been removed to maintain zero-cost operation

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    // Cron job every 15 minutes - FREE data sources only (NO API KEYS)
    if (controller.cron === '*/15 * * * *') {
      console.log('Running FREE scheduled data collection (NO API KEYS)');

      try {
        await initializeDatabase(env);
        await initializeTransactionsTable(env.CRYPTOINTEL_DB);

        // Collect data from all FREE sources
        const results = {};

        console.log('Collecting from CoinGecko Free...');
        results.coingecko_free = await fetchCoinGeckoFree(env, ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']);

        console.log('Collecting from Binance Public...');
        results.binance_public = await fetchBinanceFree(env, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT']);

        console.log('Collecting from CoinCap...');
        results.coincap = await fetchCoinCapFree(env, ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']);

        console.log('Collecting from Kraken Public...');
        results.kraken_public = await fetchKrakenFree(env, ['XXBTZUSD', 'XETHZUSD', 'SOLUSD', 'ADAUSD', 'DOTUSD']);

        console.log('Collecting from DeFi Llama...');
        results.defillama = await fetchDeFiLlamaFree(env);

        console.log('Collecting from CryptoPanic RSS...');
        results.cryptopanic_rss = await fetchCryptoPanicRSS(env);

        // Count signals
        const totalSignals = Object.values(results).reduce((sum, r) => sum + (r.data?.length || 0), 0);

        console.log('FREE data collection completed:', {
          cost: '$0',
          api_keys_used: 0,
          sources_collected: Object.keys(results).length,
          total_signals: totalSignals,
          sources: Object.keys(results)
        });

      } catch (error) {
        console.error('Scheduled data collection failed:', error);
      }
    }
  }
};

// Export app and functions for testing
export {
  app,
  getFreeDataSources,
  detectMarketSignals,
  fetchCoinGeckoFree,
  fetchBinanceFree,
  fetchCoinCapFree,
  fetchKrakenFree,
  fetchDeFiLlamaFree,
  fetchCryptoPanicRSS,
  parseRSSFeed,
  analyzeSentiment,
  extractEntities,
  calculateTVLChange
};