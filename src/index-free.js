/**
 * CryptoIntel Data Gathering System - FREE APIs ONLY Version
 * Zero-cost crypto intelligence data collection and analysis
 * NO API KEYS REQUIRED - 100% FREE
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import dashboard from './dashboard.js';
import intelligenceDashboard from './intelligence-dashboard.js';
import enhancedDashboard from './enhanced-dashboard.js';
import {
  collectFreeData,
  fetchCoinGeckoFree,
  fetchDeFiLlamaFree,
  fetchBinanceFree,
  fetchCoinCapFree,
  fetchCryptoPanicRSS
} from './free-data-collectors.js';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: '*', // Allow all origins for free API
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
    version: '2.0.0-free',
    sources: [
      'coingecko_free',
      'defillama',
      'binance_public',
      'coincap',
      'cryptopanic_rss'
    ],
    api_keys_required: false,
    cost: '$0/month'
  });
});

/**
 * Manual data collection trigger
 */
app.post('/collect', async (c) => {
  try {
    const result = await collectFreeData(c.env);
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
      signals: result,
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
      return c.json(JSON.parse(cached));
    }

    // Query from database
    const result = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT * FROM market_data WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1'
    ).bind(symbol).first();

    if (!result) {
      return c.json({
        error: 'Data not cached'
      }, 404);
    }

    // Cache for 5 minutes
    await c.env.CRYPTOINTEL_CACHE.put(
      `market_data:${symbol}`,
      JSON.stringify(result),
      { expirationTtl: 300 }
    );

    return c.json(result);
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
app.get('/enhanced-dashboard/api/stats', async (c) => {
  try {
    const signalsBySource = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT source, COUNT(*) as count FROM signals GROUP BY source'
    ).all();

    const transactions = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT COUNT(*) as total_transactions, SUM(amount) as total_revenue FROM transactions WHERE status = "confirmed"'
    ).first();

    const marketStats = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT COUNT(DISTINCT symbol) as symbols_tracked, COUNT(*) as data_points FROM market_data'
    ).first();

    const topEntities = await c.env.CRYPTOINTEL_DB.prepare(
      'SELECT entity_name, entity_type, COUNT(*) as mentions FROM entity_mentions GROUP BY entity_name, entity_type ORDER BY mentions DESC LIMIT 10'
    ).all();

    return c.json({
      signals: {
        bySource: signalsBySource.results,
        total: signalsBySource.results.reduce((sum, s) => sum + s.count, 0)
      },
      transactions: transactions || {},
      market: marketStats || {},
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
      const result = await collectFreeData(env);

      // Log to API usage table
      await env.CRYPTOINTEL_DB.prepare(
        'INSERT INTO api_usage (id, source, endpoint, request_count, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        `usage_${Date.now()}`,
        'scheduled',
        'cron_job',
        result.sources,
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
    `CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      user_wallet TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ETH',
      status TEXT NOT NULL DEFAULT 'pending',
      metadata TEXT,
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
    )`
  ];

  for (const table of tables) {
    await env.CRYPTOINTEL_DB.exec(table);
  }

  console.log('Database schema initialized');
}