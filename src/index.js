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
import { WebSocketHandler } from './websocket-handler.js';
import { AdvancedSignalDetector } from './advanced-signals.js';

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

    // Trigger advanced signal detection after basic signals are stored
    setTimeout(async () => {
      await runAdvancedSignalDetection(env);
    }, 1000); // Run after 1 second to allow basic signals to be stored
  } catch (error) {
    console.error(`Error detecting market signals for ${marketData.symbol}:`, error);
  }

  return signals;
}

/**
 * Run Advanced Signal Detection
 * Processes recent signals to detect compound patterns and correlations
 */
async function runAdvancedSignalDetection(env) {
  try {
    console.log('Running advanced signal detection...');
    
    const detector = new AdvancedSignalDetector(env);
    
    // Get recent signals from the last hour
    const recentSignals = await env.CRYPTOINTEL_DB.prepare(`
      SELECT * FROM signals
      WHERE timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).bind(Math.floor(Date.now() / 1000) - 3600).all();

    if (recentSignals.results.length === 0) {
      console.log('No recent signals found for advanced detection');
      return;
    }

    console.log(`Processing ${recentSignals.results.length} recent signals for advanced detection`);

    // Detect compound signals
    const compoundSignals = await detector.detectCompoundSignals(recentSignals.results);
    console.log(`Detected ${compoundSignals.length} compound signals`);

    // Analyze temporal patterns for each entity
    const entities = [...new Set(recentSignals.results.map(s => s.entity))];
    for (const entity of entities) {
      const entitySignals = recentSignals.results.filter(s => s.entity.includes(entity));
      const patterns = await detector.analyzeTemporalPatterns(entity, entitySignals);
      console.log(`Found ${patterns.length} temporal patterns for ${entity}`);
    }

    // Update signal performance metrics
    for (const signal of recentSignals.results) {
      // Simulate performance updates (in real implementation, this would be based on actual outcomes)
      const wasCorrect = Math.random() > 0.3; // 70% accuracy simulation
      await detector.updateSignalPerformance(signal.type, signal.source, wasCorrect);
    }

    console.log('Advanced signal detection completed');

  } catch (error) {
    console.error('Error in advanced signal detection:', error);
  }
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
// WebSocket routes
app.get('/ws', async (c) => {
  const wsHandler = new WebSocketHandler(c.env);
  return await wsHandler.handleWebSocket(c.req.raw);
});

// WebSocket stats endpoint
app.get('/ws/stats', async (c) => {
  try {
    const wsHandler = new WebSocketHandler(c.env);
    const stats = await wsHandler.getWebSocketStats();
    return c.json(stats);
  } catch (error) {
    console.error('WebSocket stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// WebSocket sessions endpoint
app.get('/ws/sessions', async (c) => {
  try {
    const wsHandler = new WebSocketHandler(c.env);
    const sessions = await wsHandler.getWebSocketSessions();
    return c.json(sessions);
  } catch (error) {
    console.error('WebSocket sessions error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// WebSocket broadcast routes for real-time data
app.post('/ws/broadcast/price', async (c) => {
  try {
    const { symbol, price, change, volume } = await c.req.json();
    const wsHandler = new WebSocketHandler(c.env);
    
    const priceData = {
      type: 'price_update',
      symbol,
      price,
      change,
      volume,
      timestamp: new Date().toISOString()
    };
    
    await wsHandler.broadcastToChannel('prices', priceData);
    return c.json({ success: true, message: 'Price update broadcasted' });
  } catch (error) {
    console.error('Price broadcast error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/ws/broadcast/signal', async (c) => {
  try {
    const signal = await c.req.json();
    const wsHandler = new WebSocketHandler(c.env);
    
    const signalData = {
      type: 'signal_notification',
      signal,
      timestamp: new Date().toISOString()
    };
    
    await wsHandler.broadcastToChannel('signals', signalData);
    return c.json({ success: true, message: 'Signal broadcasted' });
  } catch (error) {
    console.error('Signal broadcast error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/ws/broadcast/market', async (c) => {
  try {
    const marketData = await c.req.json();
    const wsHandler = new WebSocketHandler(c.env);
    
    const data = {
      type: 'market_update',
      data: marketData,
      timestamp: new Date().toISOString()
    };
    
    await wsHandler.broadcastToChannel('market', data);
    return c.json({ success: true, message: 'Market data broadcasted' });
  } catch (error) {
    console.error('Market broadcast error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.route('/enhanced-dashboard', enhancedDashboard);

// DEX endpoints removed - CoinMarketCap API key required (not free)
// All data now comes from FREE sources only

// Collect data from all FREE sources (NO API KEYS)
app.post('/collect', async (c) => {
  const results = {};
  const wsHandler = new WebSocketHandler(c.env);

  try {
    // Initialize database if needed
    await initializeDatabase(c.env);
    await initializeTransactionsTable(c.env.CRYPTOINTEL_DB);

    console.log('Starting FREE data collection from all sources...');

    // Collect from CoinGecko Free
    const cgData = await fetchCoinGeckoFree(c.env, ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot']);
    results.coingecko_free = cgData;
    
    // Broadcast price updates via WebSocket
    if (cgData && cgData.data) {
      for (const [symbol, data] of Object.entries(cgData.data)) {
        await wsHandler.broadcastPriceUpdate({
          symbol: symbol.toUpperCase(),
          price: data.current_price,
          price_change_24h: data.price_change_percentage_24h,
          volume_24h: data.total_volume,
          market_cap: data.market_cap,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Collect from Binance Public
    const binanceData = await fetchBinanceFree(c.env, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT']);
    results.binance_public = binanceData;
    
    // Broadcast Binance price updates via WebSocket
    if (binanceData && binanceData.data) {
      for (const priceData of binanceData.data) {
        await wsHandler.broadcastPriceUpdate({
          symbol: priceData.symbol.replace('USDT', ''),
          price: parseFloat(priceData.price),
          price_change_24h: parseFloat(priceData.priceChangePercent),
          volume_24h: parseFloat(priceData.volume),
          timestamp: new Date().toISOString()
        });
      }
    }

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

    // Store entity mentions and broadcast signals
    for (const [source, data] of Object.entries(results)) {
      if (data.data && Array.isArray(data.data)) {
        for (const signal of data.data) {
          // Broadcast signal via WebSocket
          await wsHandler.broadcastSignalNotification({
            id: signal.id,
            type: signal.type || 'price_alert',
            title: signal.title || `${source} Signal`,
            message: signal.description || signal.message || 'New signal detected',
            severity: signal.severity || 'medium',
            confidence_score: signal.confidence_score || 0.5,
            source: source,
            entity: signal.entity,
            timestamp: signal.timestamp || new Date().toISOString()
          });

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

    // Broadcast market data aggregation
    await wsHandler.broadcastMarketData({
      timestamp: new Date().toISOString(),
      sources: Object.keys(results),
      total_signals: Object.values(results).reduce((sum, r) => sum + (r.data?.length || 0), 0),
      market_status: 'active',
      data_quality: 'good'
    });

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

/**
 * CoinMarketCap DEX API v4 Configuration
 */
function getDEXConfig() {
  return {
    baseURL: 'https://pro-api.coinmarketcap.com',
    version: 'v4',
    rateLimit: { requests: 300, window: 60000 }, // 300 queries per minute
    endpoints: {
      spotPairs: '/dex/spot-pairs/latest',
      networks: '/dex/networks/list',
      listings: '/dex/listings/quotes',
      ohlcvHistorical: '/dex/pairs/ohlcv/historical',
      quotesLatest: '/dex/pairs/quotes/latest',
      ohlcvLatest: '/dex/pairs/ohlcv/latest',
      tradeLatest: '/dex/pairs/trade/latest',
      listingsInfo: '/dex/listings/info'
    }
  };
}

/**
 * Initialize DEX database tables
 */
async function initializeDEXTables(db) {
  try {
    // Read and execute DEX migration
    const migrationSQL = await fetch('./migrations/003_dex_tables.sql').then(r => r.text());
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.exec(statement);
      }
    }
    
    console.log('DEX tables initialized successfully');
  } catch (error) {
    console.error('DEX table initialization failed:', error);
    throw error;
  }
}

/**
 * Fetch DEX Spot Pairs from CoinMarketCap API
 */
async function fetchDEXSpotPairs(env, limit = 100) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_spot_pairs');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const url = `${config.baseURL}/${config.version}${config.endpoints.spotPairs}?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Spot Pairs API error:`, response.status);
      return { source: 'coinmarketcap_dex', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const pairs = data.data || [];

    const results = [];
    for (const pair of pairs) {
      const pairData = {
        id: `cmc_dex_pair_${pair.id}_${Date.now()}`,
        pair_id: pair.id.toString(),
        name: pair.name || `${pair.base_currency_name}/${pair.quote_currency_name}`,
        base_currency_id: pair.base_currency_id,
        quote_currency_id: pair.quote_currency_id,
        network_id: pair.network_id?.toString() || null,
        dex_id: pair.dex_id?.toString() || null,
        price: parseFloat(pair.quote?.USD?.price || 0),
        volume_24h: parseFloat(pair.quote?.USD?.volume_24h || 0),
        liquidity: parseFloat(pair.liquidity || 0),
        price_change_24h: parseFloat(pair.quote?.USD?.percent_change_24h || 0),
        last_updated: pair.last_updated ? new Date(pair.last_updated).toISOString() : null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Store in database
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO dex_pairs (id, pair_id, name, base_currency_id, quote_currency_id, network_id, dex_id, price, volume_24h, liquidity, price_change_24h, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        pairData.id,
        pairData.pair_id,
        pairData.name,
        pairData.base_currency_id,
        pairData.quote_currency_id,
        pairData.network_id,
        pairData.dex_id,
        pairData.price,
        pairData.volume_24h,
        pairData.liquidity,
        pairData.price_change_24h,
        pairData.last_updated
      ).run();

      results.push(pairData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`dex_pair:${pair.id}`, JSON.stringify(pairData), {
        expirationTtl: 300
      });
    }

    // Generate DEX signals
    await generateDEXSignals(env, results, 'spot_pairs');

    return { source: 'coinmarketcap_dex_spot_pairs', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Spot Pairs:`, error);
    return { source: 'coinmarketcap_dex_spot_pairs', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Networks from CoinMarketCap API
 */
async function fetchDEXNetworks(env) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_networks');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const url = `${config.baseURL}/${config.version}${config.endpoints.networks}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Networks API error:`, response.status);
      return { source: 'coinmarketcap_dex_networks', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const networks = data.data || [];

    const results = [];
    for (const network of networks) {
      const networkData = {
        id: `cmc_dex_network_${network.id}`,
        network_id: network.id,
        name: network.name,
        symbol: network.symbol || null,
        chain_id: network.chain_id || null,
        native_currency_id: network.native_currency_id || null,
        is_active: network.is_active !== false,
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Store in database
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO dex_networks (id, network_id, name, symbol, chain_id, native_currency_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        networkData.id,
        networkData.network_id,
        networkData.name,
        networkData.symbol,
        networkData.chain_id,
        networkData.native_currency_id,
        networkData.is_active
      ).run();

      results.push(networkData);

      // Cache for 1 hour (networks change less frequently)
      await env.CRYPTOINTEL_CACHE.put(`dex_network:${network.id}`, JSON.stringify(networkData), {
        expirationTtl: 3600
      });
    }

    return { source: 'coinmarketcap_dex_networks', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Networks:`, error);
    return { source: 'coinmarketcap_dex_networks', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Listings with Quotes from CoinMarketCap API
 */
async function fetchDEXListingsQuotes(env, limit = 100) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_listings');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const url = `${config.baseURL}/${config.version}${config.endpoints.listings}?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Listings API error:`, response.status);
      return { source: 'coinmarketcap_dex_listings', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const listings = data.data || [];

    const results = [];
    for (const listing of listings) {
      const listingData = {
        id: `cmc_dex_listing_${listing.id}`,
        dex_id: listing.id.toString(),
        name: listing.name,
        website: listing.website_url || null,
        description: listing.description || null,
        volume_24h: parseFloat(listing.quote?.USD?.volume_24h || 0),
        market_share: parseFloat(listing.market_share_percent || 0),
        number_of_pairs: listing.number_of_pairs || 0,
        is_active: listing.is_active !== false,
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Store in database
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO dex_listings (id, dex_id, name, website, description, volume_24h, market_share, number_of_pairs, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        listingData.id,
        listingData.dex_id,
        listingData.name,
        listingData.website,
        listingData.description,
        listingData.volume_24h,
        listingData.market_share,
        listingData.number_of_pairs,
        listingData.is_active
      ).run();

      results.push(listingData);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`dex_listing:${listing.id}`, JSON.stringify(listingData), {
        expirationTtl: 300
      });
    }

    return { source: 'coinmarketcap_dex_listings', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Listings:`, error);
    return { source: 'coinmarketcap_dex_listings', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Pairs OHLCV Historical data from CoinMarketCap API
 */
async function fetchDEXPairsOHLCVHistorical(env, pairId, timeStart = null, timeEnd = null, interval = '1h') {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_ohlcv');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const params = new URLSearchParams({
      pair_id: pairId,
      interval: interval
    });

    if (timeStart) params.append('time_start', timeStart);
    if (timeEnd) params.append('time_end', timeEnd);

    const url = `${config.baseURL}/${config.version}${config.endpoints.ohlcvHistorical}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX OHLCV API error:`, response.status);
      return { source: 'coinmarketcap_dex_ohlcv', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const ohlcvData = data.data || [];

    const results = [];
    for (const candle of ohlcvData) {
      const ohlcvRecord = {
        pair_id: pairId,
        timestamp: candle.time_open || Math.floor(Date.now() / 1000),
        open_price: parseFloat(candle.quote?.USD?.open || 0),
        high_price: parseFloat(candle.quote?.USD?.high || 0),
        low_price: parseFloat(candle.quote?.USD?.low || 0),
        close_price: parseFloat(candle.quote?.USD?.close || 0),
        volume: parseFloat(candle.quote?.USD?.volume || 0),
        period: interval
      };

      // Store in database
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT INTO dex_ohlcv (pair_id, timestamp, open_price, high_price, low_price, close_price, volume, period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        ohlcvRecord.pair_id,
        ohlcvRecord.timestamp,
        ohlcvRecord.open_price,
        ohlcvRecord.high_price,
        ohlcvRecord.low_price,
        ohlcvRecord.close_price,
        ohlcvRecord.volume,
        ohlcvRecord.period
      ).run();

      results.push(ohlcvRecord);
    }

    return { source: 'coinmarketcap_dex_ohlcv', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX OHLCV:`, error);
    return { source: 'coinmarketcap_dex_ohlcv', data: [], error: error.message };
  }
}

/**
 * Generate DEX-specific signals from collected data
 */
async function generateDEXSignals(env, data, sourceType) {
  const signals = [];

  try {
    for (const item of data) {
      // Volume anomaly detection
      if (item.volume_24h && item.volume_24h > 1000000) { // > $1M volume
        signals.push({
          id: `dex_volume_anomaly_${item.pair_id || item.dex_id}_${Date.now()}`,
          source: 'coinmarketcap_dex',
          type: 'dex_volume_anomaly',
          entity: item.name || item.dex_id,
          data: JSON.stringify({
            volume_24h: item.volume_24h,
            pair_id: item.pair_id,
            dex_id: item.dex_id,
            threshold: 1000000
          }),
          confidence_score: Math.min(0.9, item.volume_24h / 5000000),
          timestamp: Math.floor(Date.now() / 1000),
          processed: false
        });
      }

      // Price change anomaly
      if (item.price_change_24h && Math.abs(item.price_change_24h) > 20) { // > 20% change
        signals.push({
          id: `dex_price_spike_${item.pair_id || item.dex_id}_${Date.now()}`,
          source: 'coinmarketcap_dex',
          type: 'dex_price_spike',
          entity: item.name || item.dex_id,
          data: JSON.stringify({
            price_change_24h: item.price_change_24h,
            pair_id: item.pair_id,
            dex_id: item.dex_id,
            threshold: 20
          }),
          confidence_score: Math.min(0.8, Math.abs(item.price_change_24h) / 50),
          timestamp: Math.floor(Date.now() / 1000),
          processed: false
        });
      }

      // New pair detection (for recent items)
      if (sourceType === 'spot_pairs' && item.last_updated) {
        const updateTime = new Date(item.last_updated);
        const hoursSinceUpdate = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate < 24) { // Listed in last 24 hours
          signals.push({
            id: `dex_new_pair_${item.pair_id}_${Date.now()}`,
            source: 'coinmarketcap_dex',
            type: 'dex_new_pair',
            entity: item.name,
            data: JSON.stringify({
              pair_id: item.pair_id,
              name: item.name,
              first_seen: item.last_updated
            }),
            confidence_score: 0.9,
            timestamp: Math.floor(Date.now() / 1000),
            processed: false
          });
        }
      }
    }

    // Store signals in database
    for (const signal of signals) {
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.id,
        signal.source,
        signal.type,
        signal.entity,
        signal.data,
        signal.confidence_score,
        signal.timestamp,
        signal.processed
      ).run();

      // Also store in DEX signals table
      await env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO dex_signals (signal_type, pair_id, network_id, details, confidence_score, valid_until)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        signal.type,
        signal.data.includes('pair_id') ? JSON.parse(signal.data).pair_id : null,
        signal.data.includes('network_id') ? JSON.parse(signal.data).network_id : null,
        signal.data,
        signal.confidence_score,
        Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Valid for 24 hours
      ).run();
    }

    console.log(`Generated ${signals.length} DEX signals from ${sourceType}`);

  } catch (error) {
    console.error('Error generating DEX signals:', error);
  }

  return signals;
}

/**
 * Fetch DEX Pairs Quotes Latest from CoinMarketCap API
 */
async function fetchDEXPairsQuotesLatest(env, pairIds) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_quotes_latest');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const params = new URLSearchParams();
    if (Array.isArray(pairIds)) {
      params.append('pair_id', pairIds.join(','));
    } else {
      params.append('pair_id', pairIds);
    }

    const url = `${config.baseURL}/${config.version}${config.endpoints.quotesLatest}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Quotes Latest API error:`, response.status);
      return { source: 'coinmarketcap_dex_quotes_latest', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const quotes = data.data || [];

    const results = [];
    for (const quote of quotes) {
      const quoteData = {
        id: `cmc_dex_quote_${quote.id}_${Date.now()}`,
        pair_id: quote.id.toString(),
        name: quote.name || `${quote.base_currency_name}/${quote.quote_currency_name}`,
        price: parseFloat(quote.quote?.USD?.price || 0),
        volume_24h: parseFloat(quote.quote?.USD?.volume_24h || 0),
        market_cap: parseFloat(quote.quote?.USD?.market_cap || 0),
        price_change_24h: parseFloat(quote.quote?.USD?.percent_change_24h || 0),
        last_updated: quote.last_updated ? new Date(quote.last_updated).toISOString() : null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      results.push(quoteData);

      // Cache for 2 minutes (quotes change frequently)
      await env.CRYPTOINTEL_CACHE.put(`dex_quote:${quote.id}`, JSON.stringify(quoteData), {
        expirationTtl: 120
      });
    }

    return { source: 'coinmarketcap_dex_quotes_latest', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Quotes Latest:`, error);
    return { source: 'coinmarketcap_dex_quotes_latest', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Pairs OHLCV Latest from CoinMarketCap API
 */
async function fetchDEXPairsOHLCVLatest(env, pairIds, interval = '1h') {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_ohlcv_latest');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const params = new URLSearchParams({
      interval: interval
    });

    if (Array.isArray(pairIds)) {
      params.append('pair_id', pairIds.join(','));
    } else {
      params.append('pair_id', pairIds);
    }

    const url = `${config.baseURL}/${config.version}${config.endpoints.ohlcvLatest}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX OHLCV Latest API error:`, response.status);
      return { source: 'coinmarketcap_dex_ohlcv_latest', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const ohlcvData = data.data || [];

    const results = [];
    for (const candle of ohlcvData) {
      const ohlcvRecord = {
        pair_id: candle.pair_id,
        timestamp: candle.time_open || Math.floor(Date.now() / 1000),
        open_price: parseFloat(candle.quote?.USD?.open || 0),
        high_price: parseFloat(candle.quote?.USD?.high || 0),
        low_price: parseFloat(candle.quote?.USD?.low || 0),
        close_price: parseFloat(candle.quote?.USD?.close || 0),
        volume: parseFloat(candle.quote?.USD?.volume || 0),
        period: interval
      };

      results.push(ohlcvRecord);

      // Cache for 5 minutes
      await env.CRYPTOINTEL_CACHE.put(`dex_ohlcv_latest:${candle.pair_id}:${interval}`, JSON.stringify(ohlcvRecord), {
        expirationTtl: 300
      });
    }

    return { source: 'coinmarketcap_dex_ohlcv_latest', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX OHLCV Latest:`, error);
    return { source: 'coinmarketcap_dex_ohlcv_latest', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Pairs Trade Latest from CoinMarketCap API
 */
async function fetchDEXPairsTradeLatest(env, pairIds, limit = 100) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_trade_latest');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const params = new URLSearchParams({
      limit: limit.toString()
    });

    if (Array.isArray(pairIds)) {
      params.append('pair_id', pairIds.join(','));
    } else {
      params.append('pair_id', pairIds);
    }

    const url = `${config.baseURL}/${config.version}${config.endpoints.tradeLatest}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Trade Latest API error:`, response.status);
      return { source: 'coinmarketcap_dex_trade_latest', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const trades = data.data || [];

    const results = [];
    for (const trade of trades) {
      const tradeData = {
        id: `cmc_dex_trade_${trade.id}`,
        pair_id: trade.pair_id,
        transaction_id: trade.transaction_id || null,
        type: trade.type || 'unknown',
        amount: parseFloat(trade.amount || 0),
        price: parseFloat(trade.price || 0),
        total: parseFloat(trade.total || 0),
        timestamp: trade.timestamp || Math.floor(Date.now() / 1000)
      };

      results.push(tradeData);

      // Cache for 1 minute (trades are very time-sensitive)
      await env.CRYPTOINTEL_CACHE.put(`dex_trade:${trade.id}`, JSON.stringify(tradeData), {
        expirationTtl: 60
      });
    }

    return { source: 'coinmarketcap_dex_trade_latest', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Trade Latest:`, error);
    return { source: 'coinmarketcap_dex_trade_latest', data: [], error: error.message };
  }
}

/**
 * Fetch DEX Listings Info from CoinMarketCap API
 */
async function fetchDEXListingsInfo(env, dexIds) {
  const config = getDEXConfig();
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 300, 60000);
  const limitCheck = await rateLimiter.checkLimit('dex_listings_info');

  if (!limitCheck.allowed) {
    return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
  }

  try {
    const params = new URLSearchParams();
    if (Array.isArray(dexIds)) {
      params.append('dex_id', dexIds.join(','));
    } else {
      params.append('dex_id', dexIds);
    }

    const url = `${config.baseURL}/${config.version}${config.endpoints.listingsInfo}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CryptoIntel-Data/2.0.0'
      }
    });

    if (!response.ok) {
      console.warn(`DEX Listings Info API error:`, response.status);
      return { source: 'coinmarketcap_dex_listings_info', data: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const listings = data.data || [];

    const results = [];
    for (const listing of listings) {
      const listingData = {
        id: `cmc_dex_info_${listing.id}`,
        dex_id: listing.id.toString(),
        name: listing.name,
        website: listing.website_url || null,
        description: listing.description || null,
        logo_url: listing.logo_url || null,
        categories: listing.categories || [],
        networks: listing.networks || [],
        volume_24h: parseFloat(listing.quote?.USD?.volume_24h || 0),
        market_share: parseFloat(listing.market_share_percent || 0),
        number_of_pairs: listing.number_of_pairs || 0,
        is_active: listing.is_active !== false,
        created_at: listing.date_created ? new Date(listing.date_created).toISOString() : null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      results.push(listingData);

      // Cache for 30 minutes (DEX info changes less frequently)
      await env.CRYPTOINTEL_CACHE.put(`dex_info:${listing.id}`, JSON.stringify(listingData), {
        expirationTtl: 1800
      });
    }

    return { source: 'coinmarketcap_dex_listings_info', data: results, cached: false };

  } catch (error) {
    console.error(`Error fetching DEX Listings Info:`, error);
    return { source: 'coinmarketcap_dex_listings_info', data: [], error: error.message };
  }
}

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
  calculateTVLChange,
  // DEX API functions
  getDEXConfig,
  fetchDEXSpotPairs,
  fetchDEXNetworks,
  fetchDEXListingsQuotes,
  fetchDEXPairsOHLCVHistorical,
  fetchDEXPairsQuotesLatest,
  fetchDEXPairsOHLCVLatest,
  fetchDEXPairsTradeLatest,
  fetchDEXListingsInfo,
  generateDEXSignals,
  RateLimiter
};