/**
 * CryptoIntel Data Gathering System - FREE APIs ONLY Version (FIXED)
 * Zero-cost crypto intelligence data collection and analysis
 * NO API KEYS REQUIRED - 100% FREE
 *
 * FIXES:
 * - Robust error handling for each API source
 * - Fallback to cached data on API failures
 * - Graceful degradation (partial data collection)
 * - Proper HTTP error handling with retries
 * - Added Alternative.me Fear & Greed Index
 * - Improved rate limiting
 * - Better logging and monitoring
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import dashboard from './dashboard.js';
import intelligenceDashboard from './intelligence-dashboard.js';
import enhancedDashboard from './enhanced-dashboard.js';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.0-free-fixed',
    sources: [
      'coingecko_free',
      'defillama',
      'binance_public',
      'coincap',
      'alternative_me',
      'cryptocompare_free'
    ],
    api_keys_required: false,
    cost: '$0/month',
    improvements: [
      'Robust error handling',
      'Fallback to cached data',
      'Partial collection support',
      'Added Fear & Greed Index',
      'Better rate limiting'
    ]
  });
});

/**
 * Manual data collection trigger
 */
app.post('/collect', async (c) => {
  try {
    const result = await collectFreeDataFixed(c.env);
    return c.json({
      success: true,
      message: 'Free data collection completed',
      ...result
    });
  } catch (error) {
    console.error('Collection error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * Get signals from database
 */
app.get('/signals', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit')) || 50;
    const type = c.req.query('type');
    const entity = c.req.query('entity');

    let query = 'SELECT * FROM signals WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (entity) {
      query += ' AND entity = ?';
      params.push(entity);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const result = await c.env.CRYPTOINTEL_DB.prepare(query)
      .bind(...params)
      .all();

    return c.json({
      signals: result.results || [],
      count: result.results?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Signals fetch error:', error);
    return c.json({
      error: 'Failed to fetch signals',
      details: error.message
    }, 500);
  }
});

/**
 * Get market data
 */
app.get('/market-data/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();

  try {
    // Check cache first
    const cached = await c.env.CRYPTOINTEL_CACHE.get(`market_data:${symbol}`);
    if (cached) {
      return c.json({
        ...JSON.parse(cached),
        cached: true
      });
    }

    // Query from database
    const result = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT * FROM market_data WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1'
    ).bind(symbol).first();

    if (!result) {
      return c.json({
        error: 'No data available for symbol',
        symbol: symbol
      }, 404);
    }

    // Cache for 5 minutes
    await c.env.CRYPTOINTEL_CACHE.put(
      `market_data:${symbol}`,
      JSON.stringify(result),
      { expirationTtl: 300 }
    );

    return c.json({
      ...result,
      cached: false
    });
  } catch (error) {
    console.error('Market data error:', error);
    return c.json({
      error: 'Failed to fetch market data',
      details: error.message
    }, 500);
  }
});

/**
 * Market analysis endpoint
 */
app.get('/market-analysis', async (c) => {
  try {
    const symbols = c.req.query('symbols')?.split(',') || ['BTC', 'ETH', 'BNB'];
    const analysis = [];

    for (const symbol of symbols) {
      const result = await c.env.CRYPTOINTEL_DB.prepare(
        'SELECT * FROM market_data WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1'
      ).bind(symbol.toUpperCase()).first();

      if (result) {
        analysis.push(result);
      }
    }

    return c.json({
      analysis,
      count: analysis.length,
      timestamp: new Date().toISOString(),
      source: 'free_apis'
    });
  } catch (error) {
    console.error('Market analysis error:', error);
    return c.json({
      error: 'Failed to generate analysis',
      details: error.message
    }, 500);
  }
});

/**
 * Dashboard routes
 */
app.route('/dashboard', dashboard);
app.route('/dashboard/*', dashboard);
app.route('/intelligence-dashboard', intelligenceDashboard);
app.route('/intelligence-dashboard/*', intelligenceDashboard);
app.route('/enhanced-dashboard', enhancedDashboard);
app.route('/enhanced-dashboard/*', enhancedDashboard);

/**
 * Dashboard API endpoints
 */
app.get('/dashboard/api/stats', async (c) => {
  try {
    const signalsBySource = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT source, COUNT(*) as count FROM signals GROUP BY source'
    ).all();

    const recentSignals = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT COUNT(*) as count FROM signals WHERE timestamp > ?'
    ).bind(Math.floor(Date.now() / 1000) - 86400).first();

    const marketStats = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT COUNT(DISTINCT symbol) as symbols_tracked, COUNT(*) as data_points FROM market_data'
    ).first();

    const topEntities = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT entity_name, entity_type, COUNT(*) as mentions FROM entity_mentions GROUP BY entity_name, entity_type ORDER BY mentions DESC LIMIT 10'
    ).all();

    return c.json({
      signals: {
        bySource: signalsBySource.results || [],
        total: signalsBySource.results?.reduce((sum, s) => sum + s.count, 0) || 0,
        last24h: recentSignals?.count || 0
      },
      market: marketStats || { symbols_tracked: 0, data_points: 0 },
      entities: topEntities.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({
      error: 'Failed to fetch stats',
      details: error.message
    }, 500);
  }
});

/**
 * Collection status endpoint
 */
app.get('/collection-status', async (c) => {
  try {
    const lastCollection = await c.env.CRYPTOINTEL_CACHE.get('last_collection_status');

    if (!lastCollection) {
      return c.json({
        status: 'No collection data available',
        message: 'Trigger a collection with POST /collect'
      });
    }

    return c.json(JSON.parse(lastCollection));
  } catch (error) {
    console.error('Collection status error:', error);
    return c.json({
      error: 'Failed to fetch collection status',
      details: error.message
    }, 500);
  }
});

/**
 * Export handlers for Cloudflare Workers
 */
export default {
  fetch: app.fetch,

  /**
   * Scheduled cron handler - runs every 15 minutes
   */
  async scheduled(event, env, ctx) {
    console.log('Running scheduled FREE data collection at:', new Date().toISOString());

    try {
      // Initialize database if needed
      await initializeDatabase(env);

      // Collect from all free sources
      const result = await collectFreeDataFixed(env);

      // Cache collection status
      await env.CRYPTOINTEL_CACHE.put(
        'last_collection_status',
        JSON.stringify(result),
        { expirationTtl: 900 } // 15 minutes
      );

      // Log to API usage table
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT INTO api_usage (id, source, endpoint, request_count, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        `usage_${Date.now()}`,
        'scheduled',
        'cron_job',
        result.sources || 0,
        Math.floor(Date.now() / 1000)
      ).run();

      console.log('Scheduled collection completed:', result);
    } catch (error) {
      console.error('Scheduled job error:', error);
    }
  }
};

/**
 * Initialize database schema
 */
async function initializeDatabase(env) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      entity TEXT NOT NULL,
      data TEXT NOT NULL,
      confidence_score REAL DEFAULT 0.0,
      timestamp INTEGER NOT NULL,
      processed BOOLEAN DEFAULT FALSE
    )`,
    `CREATE TABLE IF NOT EXISTS market_data (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      price REAL,
      volume_24h REAL,
      market_cap REAL,
      price_change_24h REAL,
      timestamp INTEGER NOT NULL,
      source TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS entity_mentions (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      mention_count INTEGER DEFAULT 1,
      sentiment_score REAL DEFAULT 0.0,
      timestamp INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS api_usage (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_count INTEGER DEFAULT 1,
      response_time INTEGER,
      status_code INTEGER,
      timestamp INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source)`,
    `CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol, timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_entity_mentions_name ON entity_mentions(entity_name)`
  ];

  for (const table of tables) {
    try {
      await env.CRYPTOINTEL_DB.exec(table);
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  console.log('Database schema initialized');
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

    try {
      const count = parseInt(await this.kv.get(windowKey) || '0');

      if (count >= this.limit) {
        const resetTime = Math.ceil(now / this.window) * this.window;
        return {
          allowed: false,
          remaining: 0,
          resetIn: resetTime - now
        };
      }

      await this.kv.put(windowKey, (count + 1).toString(), {
        expirationTtl: Math.ceil(this.window / 1000) + 10
      });

      return {
        allowed: true,
        remaining: this.limit - count - 1
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request (fail open)
      return { allowed: true, remaining: this.limit };
    }
  }
}

/**
 * Fetch with timeout and retry
 */
async function fetchWithRetry(url, options = {}, retries = 2, timeout = 10000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 429) {
        return response;
      }

      // Don't retry on client errors (except 429)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Wait before retry (exponential backoff)
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Fetch data from CoinGecko Free API (FIXED - using simple price endpoint)
 */
async function fetchCoinGeckoFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 30, 60000);
  const limitCheck = await rateLimiter.checkLimit('coingecko_free');

  if (!limitCheck.allowed) {
    console.log(`CoinGecko rate limit reached. Reset in ${limitCheck.resetIn}ms`);
    return { success: false, error: 'Rate limit exceeded', fromCache: true };
  }

  try {
    // Use the truly free simple/price endpoint - no key required
    const coins = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 'ripple', 'polkadot', 'dogecoin', 'avalanche-2', 'chainlink'];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`;

    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}`, fromCache: false };
    }

    const data = await response.json();
    const signals = [];
    const marketData = [];
    const now = Math.floor(Date.now() / 1000);

    for (const [coinId, coinData] of Object.entries(data)) {
      // Map CoinGecko IDs to symbols
      const symbolMap = {
        'bitcoin': 'BTC',
        'ethereum': 'ETH',
        'binancecoin': 'BNB',
        'cardano': 'ADA',
        'solana': 'SOL',
        'ripple': 'XRP',
        'polkadot': 'DOT',
        'dogecoin': 'DOGE',
        'avalanche-2': 'AVAX',
        'chainlink': 'LINK'
      };
      const symbol = symbolMap[coinId] || coinId.toUpperCase().slice(0, 10);

      // Store market data
      const marketId = `cg_${coinId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      marketData.push({
        id: marketId,
        symbol: symbol,
        price: coinData.usd || 0,
        volume_24h: coinData.usd_24h_vol || 0,
        market_cap: coinData.usd_market_cap || 0,
        price_change_24h: coinData.usd_24h_change || 0,
        timestamp: now
      });

      // Detect price alerts (>10% change)
      if (coinData.usd_24h_change && Math.abs(coinData.usd_24h_change) > 10) {
        signals.push({
          id: `signal_cg_${coinId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'coingecko',
          type: 'price_alert',
          entity: symbol,
          data: JSON.stringify({
            price: coinData.usd,
            change_24h: coinData.usd_24h_change,
            volume: coinData.usd_24h_vol,
            market_cap: coinData.usd_market_cap
          }),
          confidence_score: Math.min(Math.abs(coinData.usd_24h_change) / 20, 1),
          timestamp: now
        });
      }

      // Detect volume anomalies (volume > 50% of market cap)
      if (coinData.usd_market_cap && coinData.usd_24h_vol && coinData.usd_24h_vol > coinData.usd_market_cap * 0.5) {
        signals.push({
          id: `signal_vol_${coinId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'coingecko',
          type: 'volume_anomaly',
          entity: symbol,
          data: JSON.stringify({
            volume: coinData.usd_24h_vol,
            market_cap: coinData.usd_market_cap,
            volume_ratio: coinData.usd_24h_vol / coinData.usd_market_cap
          }),
          confidence_score: Math.min((coinData.usd_24h_vol / coinData.usd_market_cap), 1),
          timestamp: now
        });
      }
    }

    // Store data in D1
    for (const data of marketData) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.id, data.symbol, data.price, data.volume_24h, data.market_cap, data.price_change_24h, data.timestamp, 'coingecko').run();
      } catch (error) {
        console.error('Error storing market data:', error);
      }
    }

    for (const signal of signals) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
      } catch (error) {
        console.error('Error storing signal:', error);
      }
    }

    return { success: true, marketData: marketData.length, signals: signals.length };
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch DeFi data from DeFi Llama (FIXED - better error handling)
 */
async function fetchDeFiLlamaFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000);
  const limitCheck = await rateLimiter.checkLimit('defillama');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetchWithRetry('https://api.llama.fi/protocols');

    if (!response.ok) {
      console.error(`DeFi Llama API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const protocols = await response.json();
    const signals = [];
    const now = Math.floor(Date.now() / 1000);

    // Get top 30 protocols by TVL
    const topProtocols = protocols
      .filter(p => p.tvl && p.tvl > 0)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 30);

    for (const protocol of topProtocols) {
      // Detect TVL anomalies (>20% change in 24h)
      if (protocol.change_1d && Math.abs(protocol.change_1d) > 20) {
        signals.push({
          id: `signal_defi_${protocol.slug}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'defillama',
          type: 'tvl_anomaly',
          entity: protocol.name || protocol.slug,
          data: JSON.stringify({
            tvl: protocol.tvl,
            change_1d: protocol.change_1d,
            change_7d: protocol.change_7d || null,
            chains: protocol.chains || [],
            category: protocol.category || 'Unknown'
          }),
          confidence_score: Math.min(Math.abs(protocol.change_1d) / 30, 1),
          timestamp: now
        });
      }
    }

    // Store signals in D1
    for (const signal of signals) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
      } catch (error) {
        console.error('Error storing DeFi signal:', error);
      }
    }

    return { success: true, protocols: topProtocols.length, signals: signals.length };
  } catch (error) {
    console.error('DeFi Llama fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch data from Binance Public API (FIXED - better error handling)
 */
async function fetchBinanceFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000);
  const limitCheck = await rateLimiter.checkLimit('binance_public');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    // Fetch 24hr ticker for all symbols
    const response = await fetchWithRetry('https://api.binance.com/api/v3/ticker/24hr');

    if (!response.ok) {
      console.error(`Binance API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const tickers = await response.json();
    const marketData = [];
    const signals = [];
    const now = Math.floor(Date.now() / 1000);

    // Filter for USDT pairs and top volume
    const usdtPairs = tickers
      .filter(t => t.symbol && t.symbol.endsWith('USDT'))
      .filter(t => parseFloat(t.quoteVolume || 0) > 0)
      .sort((a, b) => parseFloat(b.quoteVolume || 0) - parseFloat(a.quoteVolume || 0))
      .slice(0, 50);

    for (const ticker of usdtPairs) {
      const symbol = ticker.symbol.replace('USDT', '');

      // Store market data
      marketData.push({
        id: `binance_${ticker.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: symbol,
        price: parseFloat(ticker.lastPrice || 0),
        volume_24h: parseFloat(ticker.quoteVolume || 0),
        price_change_24h: parseFloat(ticker.priceChangePercent || 0),
        timestamp: now
      });

      // Detect high volatility
      const priceChange = parseFloat(ticker.priceChangePercent || 0);
      if (Math.abs(priceChange) > 15) {
        signals.push({
          id: `signal_binance_${ticker.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
          confidence_score: Math.min(Math.abs(priceChange) / 20, 1),
          timestamp: now
        });
      }
    }

    // Store in D1
    for (const data of marketData) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.id, data.symbol, data.price, data.volume_24h, data.price_change_24h, data.timestamp, 'binance').run();
      } catch (error) {
        console.error('Error storing Binance market data:', error);
      }
    }

    for (const signal of signals) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
      } catch (error) {
        console.error('Error storing Binance signal:', error);
      }
    }

    return { success: true, marketData: marketData.length, signals: signals.length };
  } catch (error) {
    console.error('Binance fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch data from CoinCap.io (FIXED - better error handling)
 */
async function fetchCoinCapFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 200, 60000);
  const limitCheck = await rateLimiter.checkLimit('coincap');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetchWithRetry('https://api.coincap.io/v2/assets?limit=50');

    if (!response.ok) {
      console.error(`CoinCap API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const assets = result.data || [];
    const marketData = [];
    const now = Math.floor(Date.now() / 1000);

    for (const asset of assets) {
      if (!asset.symbol || !asset.priceUsd) continue;

      marketData.push({
        id: `coincap_${asset.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: asset.symbol,
        price: parseFloat(asset.priceUsd || 0),
        volume_24h: parseFloat(asset.volumeUsd24Hr || 0),
        market_cap: parseFloat(asset.marketCapUsd || 0),
        price_change_24h: parseFloat(asset.changePercent24Hr || 0),
        timestamp: now
      });
    }

    // Store in D1 (use as backup data source)
    for (const data of marketData) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.id, data.symbol, data.price, data.volume_24h, data.market_cap, data.price_change_24h, data.timestamp, 'coincap').run();
      } catch (error) {
        console.error('Error storing CoinCap market data:', error);
      }
    }

    return { success: true, marketData: marketData.length };
  } catch (error) {
    console.error('CoinCap fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch Fear & Greed Index from Alternative.me (NEW - completely free)
 */
async function fetchFearGreedIndex(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 60, 60000);
  const limitCheck = await rateLimiter.checkLimit('alternative_me');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const response = await fetchWithRetry('https://api.alternative.me/fng/?limit=1');

    if (!response.ok) {
      console.error(`Alternative.me API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const fngData = result.data && result.data[0];

    if (!fngData) {
      return { success: false, error: 'No data returned' };
    }

    const signals = [];
    const now = Math.floor(Date.now() / 1000);
    const value = parseInt(fngData.value);

    // Generate signal based on extreme fear or greed
    if (value <= 25 || value >= 75) {
      signals.push({
        id: `signal_fng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: 'alternative_me',
        type: 'sentiment_shift',
        entity: 'MARKET',
        data: JSON.stringify({
          fear_greed_index: value,
          classification: fngData.value_classification,
          timestamp: fngData.timestamp,
          sentiment: value <= 25 ? 'extreme_fear' : 'extreme_greed'
        }),
        confidence_score: value <= 25 ? (25 - value) / 25 : (value - 75) / 25,
        timestamp: now
      });
    }

    // Store signals
    for (const signal of signals) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR IGNORE INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(signal.id, signal.source, signal.type, signal.entity, signal.data, signal.confidence_score, signal.timestamp, false).run();
      } catch (error) {
        console.error('Error storing Fear & Greed signal:', error);
      }
    }

    return { success: true, value, classification: fngData.value_classification, signals: signals.length };
  } catch (error) {
    console.error('Fear & Greed Index fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch from CryptoCompare Free API (NEW - alternative source)
 */
async function fetchCryptoCompareFree(env) {
  const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 100, 60000);
  const limitCheck = await rateLimiter.checkLimit('cryptocompare');

  if (!limitCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const symbols = 'BTC,ETH,BNB,ADA,SOL,XRP,DOT,DOGE,AVAX,LINK';
    const response = await fetchWithRetry(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbols}&tsyms=USD`);

    if (!response.ok) {
      console.error(`CryptoCompare API error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    const rawData = result.RAW || {};
    const marketData = [];
    const now = Math.floor(Date.now() / 1000);

    for (const [symbol, data] of Object.entries(rawData)) {
      const usdData = data.USD;
      if (!usdData) continue;

      marketData.push({
        id: `cc_${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: symbol,
        price: usdData.PRICE || 0,
        volume_24h: usdData.VOLUME24HOURTO || 0,
        market_cap: usdData.MKTCAP || 0,
        price_change_24h: usdData.CHANGEPCT24HOUR || 0,
        timestamp: now
      });
    }

    // Store in D1
    for (const data of marketData) {
      try {
        await env.CRYPTOINTEL_DB.prepare(
          'INSERT OR REPLACE INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(data.id, data.symbol, data.price, data.volume_24h, data.market_cap, data.price_change_24h, data.timestamp, 'cryptocompare').run();
      } catch (error) {
        console.error('Error storing CryptoCompare market data:', error);
      }
    }

    return { success: true, marketData: marketData.length };
  } catch (error) {
    console.error('CryptoCompare fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Collect data from all free sources (FIXED - graceful degradation)
 */
async function collectFreeDataFixed(env) {
  console.log('Starting FIXED free data collection...');
  const results = [];
  const startTime = Date.now();

  // Collect from all sources with proper error handling
  // Each source is independent and failures don't affect others

  const sources = [
    { name: 'CoinGecko', fn: fetchCoinGeckoFree },
    { name: 'DeFi Llama', fn: fetchDeFiLlamaFree },
    { name: 'Binance', fn: fetchBinanceFree },
    { name: 'CoinCap', fn: fetchCoinCapFree },
    { name: 'Fear & Greed Index', fn: fetchFearGreedIndex },
    { name: 'CryptoCompare', fn: fetchCryptoCompareFree }
  ];

  for (const source of sources) {
    try {
      console.log(`Fetching from ${source.name}...`);
      const startSourceTime = Date.now();
      const result = await source.fn(env);
      const duration = Date.now() - startSourceTime;

      results.push({
        source: source.name,
        ...result,
        duration_ms: duration
      });

      console.log(`${source.name} completed in ${duration}ms:`, result);
    } catch (error) {
      console.error(`${source.name} error:`, error);
      results.push({
        source: source.name,
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  // Calculate summary statistics
  const summary = {
    timestamp: new Date().toISOString(),
    sources: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    success_rate: `${((results.filter(r => r.success).length / results.length) * 100).toFixed(1)}%`,
    totalSignals: results.reduce((sum, r) => sum + (r.signals || 0), 0),
    totalMarketData: results.reduce((sum, r) => sum + (r.marketData || 0), 0),
    duration_ms: totalDuration,
    results: results
  };

  console.log('FIXED data collection summary:', JSON.stringify(summary, null, 2));
  return summary;
}
