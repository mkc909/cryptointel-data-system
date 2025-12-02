/**
 * Enhanced CryptoIntel Dashboard
 * Advanced visualizations with real-time SSE updates, interactive charts, and filtering
 * All Chart.js dependencies embedded inline - no external CDN required
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

const enhancedDashboard = new Hono();

// CORS configuration
enhancedDashboard.use('/*', cors({
  origin: ['https://tradingmindset.app', 'https://tools-x402-production.magicmike.workers.dev'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// In-memory cache for dashboard data (expires after 2 minutes)
const dashboardCache = new Map();
const CACHE_TTL = 120000; // 2 minutes

/**
 * Cache helper functions
 */
function getCached(key) {
  const cached = dashboardCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  dashboardCache.delete(key);
  return null;
}

function setCache(key, data) {
  dashboardCache.set(key, { data, timestamp: Date.now() });

  // Cleanup old cache entries (keep last 50)
  if (dashboardCache.size > 50) {
    const firstKey = dashboardCache.keys().next().value;
    dashboardCache.delete(firstKey);
  }
}

/**
 * Main Enhanced Dashboard Route
 */
enhancedDashboard.get('/', async (c) => {
  const html = generateEnhancedDashboardHTML();
  return c.html(html);
});

/**
 * Real-time updates via Server-Sent Events
 */
enhancedDashboard.get('/api/realtime', async (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;

    // Send updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        const signals = await getRecentSignals(c.env, 10);
        const stats = await getQuickStats(c.env);

        await stream.writeSSE({
          id: String(id++),
          event: 'update',
          data: JSON.stringify({
            signals: signals,
            stats: stats,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('SSE error:', error);
      }
    }, 5000);

    // Cleanup on connection close
    stream.onAbort(() => {
      clearInterval(interval);
    });
  });
});

/**
 * Analytics aggregation endpoint
 */
enhancedDashboard.get('/api/analytics', async (c) => {
  try {
    const cached = getCached('analytics');
    if (cached) {
      return c.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    const timeRange = c.req.query('range') || '24h';
    const timeRangeSeconds = getTimeRangeSeconds(timeRange);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - timeRangeSeconds;

    // Signal timeline data (hourly buckets)
    const signalTimeline = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        datetime(timestamp, 'unixepoch', 'localtime') as hour,
        type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM signals
      WHERE timestamp > ?
      GROUP BY hour, type
      ORDER BY hour ASC
    `).bind(startTime).all();

    // Confidence score distribution
    const confidenceDistribution = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        CASE
          WHEN confidence_score >= 0.9 THEN 'Very High'
          WHEN confidence_score >= 0.7 THEN 'High'
          WHEN confidence_score >= 0.5 THEN 'Medium'
          ELSE 'Low'
        END as confidence_range,
        COUNT(*) as count
      FROM signals
      WHERE timestamp > ?
      GROUP BY confidence_range
      ORDER BY MIN(confidence_score) DESC
    `).bind(startTime).all();

    // Entity mention frequency
    const entityHeatmap = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        entity_name,
        entity_type,
        COUNT(*) as mention_count,
        AVG(sentiment_score) as avg_sentiment
      FROM entity_mentions
      WHERE timestamp > ?
      GROUP BY entity_name, entity_type
      ORDER BY mention_count DESC
      LIMIT 20
    `).bind(startTime).all();

    // Market trends with price/volume
    const marketTrends = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        symbol,
        datetime(timestamp, 'unixepoch', 'localtime') as time,
        price,
        volume_24h,
        price_change_24h
      FROM market_data
      WHERE timestamp > ?
      ORDER BY symbol, timestamp ASC
    `).bind(startTime).all();

    // Signal type breakdown
    const signalTypeBreakdown = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        type,
        source,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM signals
      WHERE timestamp > ?
      GROUP BY type, source
      ORDER BY count DESC
    `).bind(startTime).all();

    const analytics = {
      signalTimeline: signalTimeline.results || [],
      confidenceDistribution: confidenceDistribution.results || [],
      entityHeatmap: entityHeatmap.results || [],
      marketTrends: marketTrends.results || [],
      signalTypeBreakdown: signalTypeBreakdown.results || [],
      timeRange: timeRange,
      timestamp: new Date().toISOString()
    };

    setCache('analytics', analytics);
    return c.json(analytics);

  } catch (error) {
    console.error('Analytics error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Filter options endpoint
 */
enhancedDashboard.get('/api/filters', async (c) => {
  try {
    const cached = getCached('filters');
    if (cached) {
      return c.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    // Get available signal types
    const signalTypes = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT DISTINCT type FROM signals ORDER BY type
    `).all();

    // Get available sources
    const sources = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT DISTINCT source FROM signals ORDER BY source
    `).all();

    // Get available entities (top 50)
    const entities = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT DISTINCT entity_name, entity_type
      FROM entity_mentions
      ORDER BY entity_name
      LIMIT 50
    `).all();

    // Get confidence ranges
    const confidenceRanges = [
      { label: 'Very High', min: 0.9, max: 1.0 },
      { label: 'High', min: 0.7, max: 0.9 },
      { label: 'Medium', min: 0.5, max: 0.7 },
      { label: 'Low', min: 0.0, max: 0.5 }
    ];

    const filters = {
      signalTypes: signalTypes.results?.map(r => r.type) || [],
      sources: sources.results?.map(r => r.source) || [],
      entities: entities.results || [],
      confidenceRanges: confidenceRanges,
      timestamp: new Date().toISOString()
    };

    setCache('filters', filters);
    return c.json(filters);

  } catch (error) {
    console.error('Filters error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Enhanced Stats API with more detailed metrics
 */
enhancedDashboard.get('/api/stats', async (c) => {
  try {
    const cached = getCached('stats');
    if (cached) {
      return c.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - (24 * 60 * 60);
    const weekAgo = now - (7 * 24 * 60 * 60);

    // Signal stats
    const signalStats = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        source,
        type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM signals
      WHERE timestamp > ?
      GROUP BY source, type
      ORDER BY count DESC
    `).bind(dayAgo).all();

    // Transaction revenue stats
    const transactionStats = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction,
        COUNT(DISTINCT user_wallet) as unique_users
      FROM transactions
      WHERE status = 'confirmed' AND timestamp > ?
    `).bind(weekAgo).first();

    // Market data stats
    const marketStats = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        COUNT(DISTINCT symbol) as symbols_tracked,
        COUNT(*) as data_points,
        AVG(price_change_24h) as avg_change
      FROM market_data
      WHERE timestamp > ?
    `).bind(dayAgo).first();

    // Top entities
    const entityStats = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        entity_name,
        entity_type,
        COUNT(*) as mention_count,
        AVG(sentiment_score) as avg_sentiment
      FROM entity_mentions
      WHERE timestamp > ?
      GROUP BY entity_name, entity_type
      ORDER BY mention_count DESC
      LIMIT 10
    `).bind(dayAgo).all();

    const stats = {
      signals: {
        bySource: signalStats.results || [],
        total: signalStats.results?.reduce((sum, s) => sum + s.count, 0) || 0
      },
      transactions: transactionStats || {
        total_transactions: 0,
        total_revenue: 0,
        avg_transaction: 0,
        unique_users: 0
      },
      market: marketStats || {
        symbols_tracked: 0,
        data_points: 0,
        avg_change: 0
      },
      entities: entityStats.results || [],
      timestamp: new Date().toISOString()
    };

    setCache('stats', stats);
    return c.json(stats);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Real-time Signals API with filtering
 */
enhancedDashboard.get('/api/signals', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const type = c.req.query('type');
    const entity = c.req.query('entity');
    const minConfidence = parseFloat(c.req.query('minConfidence') || '0');

    let query = `
      SELECT s.*, em.entity_name, em.entity_type, em.sentiment_score as entity_sentiment
      FROM signals s
      LEFT JOIN entity_mentions em ON s.id = em.signal_id
      WHERE s.timestamp > ?
    `;

    const dayAgoInSeconds = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    const params = [dayAgoInSeconds];

    if (type) {
      query += ' AND s.type = ?';
      params.push(type);
    }

    if (entity) {
      query += ' AND (s.entity LIKE ? OR em.entity_name LIKE ?)';
      params.push('%' + entity + '%', '%' + entity + '%');
    }

    if (minConfidence > 0) {
      query += ' AND s.confidence_score >= ?';
      params.push(minConfidence);
    }

    query += ' ORDER BY s.confidence_score DESC, s.timestamp DESC LIMIT ?';
    params.push(limit);

    const signals = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();

    return c.json({
      signals: signals.results || [],
      count: signals.results?.length || 0,
      filters: { type, entity, minConfidence },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Signals API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Market Data API with historical trends
 */
enhancedDashboard.get('/api/market', async (c) => {
  try {
    const symbols = (c.req.query('symbols') || 'BTC,ETH,SOL').split(',');
    const timeRange = c.req.query('range') || '24h';
    const timeRangeMs = getTimeRangeMs(timeRange);

    const marketData = [];

    for (const symbol of symbols) {
      const data = await c.env.CRYPTOINTEL_DB.prepare(`
        SELECT
          symbol,
          AVG(price) as avg_price,
          MAX(price) as max_price,
          MIN(price) as min_price,
          AVG(volume_24h) as avg_volume,
          AVG(price_change_24h) as avg_change,
          COUNT(*) as data_points
        FROM market_data
        WHERE symbol = ? AND timestamp > ?
        GROUP BY symbol
      `).bind(symbol.trim(), Date.now() - timeRangeMs).first();

      if (data) {
        marketData.push({
          symbol: data.symbol,
          avgPrice: data.avg_price,
          maxPrice: data.max_price,
          minPrice: data.min_price,
          avgVolume: data.avg_volume,
          avgChange: data.avg_change,
          dataPoints: data.data_points,
          trend: data.avg_change > 0 ? 'bullish' : 'bearish'
        });
      }
    }

    return c.json({
      marketData: marketData,
      timeRange: timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Market API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Transaction Analytics API
 */
enhancedDashboard.get('/api/transactions', async (c) => {
  try {
    const timeRange = c.req.query('range') || '7d';
    const timeRangeMs = getTimeRangeMs(timeRange);

    const transactions = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        tool_id,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction_value,
        currency,
        DATE(datetime(timestamp, 'unixepoch')) as date
      FROM transactions
      WHERE status = 'confirmed' AND timestamp > ?
      GROUP BY tool_id, currency, date
      ORDER BY date DESC
    `).bind(Date.now() - timeRangeMs).all();

    const summary = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        tool_id,
        COUNT(*) as total_transactions,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction_value,
        currency
      FROM transactions
      WHERE status = 'confirmed' AND timestamp > ?
      GROUP BY tool_id, currency
      ORDER BY total_revenue DESC
    `).bind(Date.now() - timeRangeMs).all();

    return c.json({
      transactions: transactions.results || [],
      summary: summary.results || [],
      timeRange: timeRange,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transactions API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Entity Tracking API
 */
enhancedDashboard.get('/api/entities', async (c) => {
  try {
    const entityType = c.req.query('type');
    const limit = parseInt(c.req.query('limit') || '20');

    let query = `
      SELECT
        entity_name,
        entity_type,
        COUNT(*) as mention_count,
        AVG(sentiment_score) as avg_sentiment,
        MIN(timestamp) as first_mention,
        MAX(timestamp) as last_mention
      FROM entity_mentions
      WHERE timestamp > ?
    `;

    const params = [Date.now() - (7 * 24 * 60 * 60 * 1000)];

    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }

    query += ' GROUP BY entity_name, entity_type ORDER BY mention_count DESC LIMIT ?';
    params.push(limit);

    const entities = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();

    return c.json({
      entities: entities.results || [],
      count: entities.results?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Entities API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Advanced signals endpoint with multi-filter support
 */
enhancedDashboard.get('/api/signals/advanced', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const types = c.req.query('types')?.split(',') || [];
    const sources = c.req.query('sources')?.split(',') || [];
    const entity = c.req.query('entity');
    const minConfidence = parseFloat(c.req.query('minConfidence') || '0.0');
    const maxConfidence = parseFloat(c.req.query('maxConfidence') || '1.0');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    let query = `
      SELECT s.*, em.entity_name, em.entity_type, em.sentiment_score as entity_sentiment
      FROM signals s
      LEFT JOIN entity_mentions em ON s.id = em.signal_id
      WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (types.length > 0) {
      query += ' AND s.type IN (' + types.map(() => '?').join(',') + ')';
      params.push(...types);
    }

    if (sources.length > 0) {
      query += ' AND s.source IN (' + sources.map(() => '?').join(',') + ')';
      params.push(...sources);
    }

    if (entity) {
      query += ` AND em.entity_name LIKE ?`;
      params.push('%' + entity + '%');
    }

    if (minConfidence > 0) {
      query += ` AND s.confidence_score >= ?`;
      params.push(minConfidence);
    }

    if (maxConfidence < 1) {
      query += ` AND s.confidence_score <= ?`;
      params.push(maxConfidence);
    }

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      query += ` AND s.timestamp >= ?`;
      params.push(startTimestamp);
    }

    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      query += ` AND s.timestamp <= ?`;
      params.push(endTimestamp);
    }

    query += ` ORDER BY s.confidence_score DESC, s.timestamp DESC LIMIT ?`;
    params.push(limit);

    const signals = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();

    return c.json({
      signals: signals.results || [],
      count: signals.results?.length || 0,
      filters: { types, sources, entity, minConfidence, maxConfidence, startDate, endDate },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Advanced signals error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Export data endpoint (JSON or CSV)
 */
enhancedDashboard.get('/api/export', async (c) => {
  try {
    const format = c.req.query('format') || 'json';
    const dataType = c.req.query('type') || 'signals';
    const limit = parseInt(c.req.query('limit') || '100');

    let data;

    if (dataType === 'signals') {
      const result = await c.env.CRYPTOINTEL_DB.prepare(`
        SELECT s.*, em.entity_name, em.entity_type
        FROM signals s
        LEFT JOIN entity_mentions em ON s.id = em.signal_id
        ORDER BY s.timestamp DESC
        LIMIT ?
      `).bind(limit).all();
      data = result.results || [];
    } else if (dataType === 'market') {
      const result = await c.env.CRYPTOINTEL_DB.prepare(`
        SELECT * FROM market_data
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(limit).all();
      data = result.results || [];
    } else if (dataType === 'transactions') {
      const result = await c.env.CRYPTOINTEL_DB.prepare(`
        SELECT * FROM transactions
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(limit).all();
      data = result.results || [];
    } else {
      return c.json({ error: 'Invalid data type' }, { status: 400 });
    }

    if (format === 'csv') {
      const csv = convertToCSV(data);
      return c.text(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="' + dataType + '_export_' + Date.now() + '.csv"'
        }
      });
    }

    return c.json(data, {
      headers: {
        'Content-Disposition': 'attachment; filename="' + dataType + '_export_' + Date.now() + '.json"'
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Helper functions
 */

async function getRecentSignals(env, limit = 10) {
  const result = await env.CRYPTOINTEL_DB.prepare(`
    SELECT s.*, em.entity_name, em.entity_type
    FROM signals s
    LEFT JOIN entity_mentions em ON s.id = em.signal_id
    ORDER BY s.timestamp DESC
    LIMIT ?
  `).bind(limit).all();

  return result.results || [];
}

async function getQuickStats(env) {
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - (24 * 60 * 60);

  const signalCount = await env.CRYPTOINTEL_DB.prepare(`
    SELECT COUNT(*) as count FROM signals WHERE timestamp > ?
  `).bind(dayAgo).first();

  const avgConfidence = await env.CRYPTOINTEL_DB.prepare(`
    SELECT AVG(confidence_score) as avg FROM signals WHERE timestamp > ?
  `).bind(dayAgo).first();

  return {
    signalCount: signalCount?.count || 0,
    avgConfidence: avgConfidence?.avg || 0
  };
}

function getTimeRangeSeconds(range) {
  const ranges = {
    '1h': 60 * 60,
    '6h': 6 * 60 * 60,
    '12h': 12 * 60 * 60,
    '24h': 24 * 60 * 60,
    '7d': 7 * 24 * 60 * 60,
    '30d': 30 * 24 * 60 * 60
  };
  return ranges[range] || ranges['24h'];
}

function getTimeRangeMs(range) {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return ranges[range] || ranges['24h'];
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',')
        ? `"${value}"`
        : value;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate Enhanced Dashboard HTML
 */
function generateEnhancedDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CryptoIntel - Enhanced Real-Time Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-card: #1e293b;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --border: #334155;
            --accent: #3b82f6;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --purple: #8b5cf6;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }

        .header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .logo-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent), var(--purple));
            border-radius: 8px;
        }

        .header-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }

        .btn-primary {
            background: var(--accent);
            color: white;
        }

        .btn-primary:hover {
            background: #2563eb;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.5rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .stat-icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .chart-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.5rem;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .chart-title {
            font-size: 1.125rem;
            font-weight: 600;
        }

        .filter-group {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-bottom: 1rem;
        }

        .filter-btn {
            padding: 0.375rem 0.75rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }

        .filter-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
        }

        .filter-btn.active {
            background: var(--accent);
            border-color: var(--accent);
            color: white;
        }

        .table-container {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 2rem;
        }

        .table-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        thead {
            background: var(--bg-secondary);
        }

        th {
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        td {
            padding: 1rem;
            border-top: 1px solid var(--border);
        }

        tr:hover {
            background: var(--bg-secondary);
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .badge-success {
            background: rgba(16, 185, 129, 0.2);
            color: var(--success);
        }

        .badge-warning {
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning);
        }

        .badge-danger {
            background: rgba(239, 68, 68, 0.2);
            color: var(--danger);
        }

        .badge-info {
            background: rgba(59, 130, 246, 0.2);
            color: var(--accent);
        }

        .trend-up {
            color: var(--success);
        }

        .trend-down {
            color: var(--danger);
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
        }

        .spinner {
            border: 3px solid var(--border);
            border-top: 3px solid var(--accent);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }

            .chart-grid {
                grid-template-columns: 1fr;
            }

            .header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }

            .header-controls {
                width: 100%;
                justify-content: space-between;
            }

            table {
                font-size: 0.875rem;
            }

            th, td {
                padding: 0.75rem 0.5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="logo">
            <div class="logo-icon"></div>
            <span>CryptoIntel Dashboard</span>
        </div>
        <div class="header-controls">
            <div class="status-indicator">
                <span class="status-dot"></span>
                <span id="lastUpdate">Live</span>
            </div>
            <button class="btn btn-primary" onclick="refreshDashboard()">Refresh</button>
        </div>
    </header>

    <div class="container">
        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <div>
                        <div class="stat-value" id="signalsTotal">-</div>
                        <div class="stat-label">Signals (24h)</div>
                    </div>
                    <div class="stat-icon" style="background: rgba(59, 130, 246, 0.2); color: var(--accent);">📊</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div>
                        <div class="stat-value" id="revenueTotal">-</div>
                        <div class="stat-label">Revenue (7d)</div>
                    </div>
                    <div class="stat-icon" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">💰</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div>
                        <div class="stat-value" id="usersTotal">-</div>
                        <div class="stat-label">Active Users</div>
                    </div>
                    <div class="stat-icon" style="background: rgba(139, 92, 246, 0.2); color: var(--purple);">👥</div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <div>
                        <div class="stat-value" id="marketChange">-</div>
                        <div class="stat-label">Avg Market Change</div>
                    </div>
                    <div class="stat-icon" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);">📈</div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filter-group">
            <button class="filter-btn active" data-type="all" onclick="filterSignals('all')">All Signals</button>
            <button class="filter-btn" data-type="sentiment_shift" onclick="filterSignals('sentiment_shift')">Sentiment</button>
            <button class="filter-btn" data-type="tvl_anomaly" onclick="filterSignals('tvl_anomaly')">TVL Anomaly</button>
            <button class="filter-btn" data-type="volume_anomaly" onclick="filterSignals('volume_anomaly')">Volume</button>
            <button class="filter-btn" data-type="price_alert" onclick="filterSignals('price_alert')">Price Alert</button>
        </div>

        <!-- Charts -->
        <div class="chart-grid">
            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Signal Sources</h3>
                </div>
                <canvas id="signalsChart"></canvas>
            </div>

            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Market Trends</h3>
                </div>
                <canvas id="marketChart"></canvas>
            </div>

            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Revenue Analytics</h3>
                </div>
                <canvas id="revenueChart"></canvas>
            </div>

            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Top Entities</h3>
                </div>
                <canvas id="entitiesChart"></canvas>
            </div>
        </div>

        <!-- Real-time Signals Table -->
        <div class="table-container">
            <div class="table-header">
                <h3 class="chart-title">Real-Time Signals</h3>
                <span class="stat-label" id="signalsCount">0 signals</span>
            </div>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th>Type</th>
                            <th>Entity</th>
                            <th>Confidence</th>
                            <th>Sentiment</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody id="signalsTable">
                        <tr>
                            <td colspan="6" class="loading">
                                <div class="spinner"></div>
                                <p style="margin-top: 1rem;">Loading signals...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Entity Tracking Table -->
        <div class="table-container">
            <div class="table-header">
                <h3 class="chart-title">Entity Mentions</h3>
            </div>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Entity</th>
                            <th>Type</th>
                            <th>Mentions</th>
                            <th>Avg Sentiment</th>
                            <th>Last Mention</th>
                        </tr>
                    </thead>
                    <tbody id="entitiesTable">
                        <tr>
                            <td colspan="5" class="loading">Loading entities...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        // Chart instances
        let signalsChart, marketChart, revenueChart, entitiesChart;
        let currentFilter = 'all';
        let wsClient = null;

        // WebSocket Client for real-time updates
        class CryptoIntelWebSocket {
            constructor() {
                this.ws = null;
                this.reconnectAttempts = 0;
                this.maxReconnectAttempts = 5;
                this.reconnectDelay = 1000;
                this.isConnected = false;
            }

            connect() {
                try {
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsUrl = `${protocol}//${window.location.host}/ws`;
                    
                    this.ws = new WebSocket(wsUrl);
                    
                    this.ws.onopen = () => {
                        console.log('WebSocket connected');
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        
                        // Subscribe to all channels
                        this.subscribe('prices');
                        this.subscribe('signals');
                        this.subscribe('market');
                        
                        // Update connection status
                        this.updateConnectionStatus('Connected');
                    };

                    this.ws.onmessage = (event) => {
                        try {
                            const message = JSON.parse(event.data);
                            this.handleMessage(message);
                        } catch (error) {
                            console.error('WebSocket message error:', error);
                        }
                    };

                    this.ws.onclose = () => {
                        console.log('WebSocket disconnected');
                        this.isConnected = false;
                        this.updateConnectionStatus('Disconnected');
                        this.attemptReconnect();
                    };

                    this.ws.onerror = (error) => {
                        console.error('WebSocket error:', error);
                        this.updateConnectionStatus('Error');
                    };

                } catch (error) {
                    console.error('WebSocket connection error:', error);
                }
            }

            subscribe(channel) {
                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'subscribe',
                        channel: channel
                    }));
                }
            }

            unsubscribe(channel) {
                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'unsubscribe',
                        channel: channel
                    }));
                }
            }

            handleMessage(message) {
                switch (message.type) {
                    case 'price_update':
                        this.handlePriceUpdate(message.data);
                        break;
                    case 'signal_notification':
                        this.handleSignalNotification(message.data);
                        break;
                    case 'market_data':
                        this.handleMarketData(message.data);
                        break;
                    case 'pong':
                        // Heartbeat response
                        break;
                    default:
                        console.log('Unknown message type:', message.type);
                }
            }

            handlePriceUpdate(data) {
                // Update price displays in real-time
                console.log('Price update:', data);
                
                // Update market chart if visible
                if (marketChart && data.symbol) {
                    // Find existing data point and update it
                    const dataset = marketChart.data.datasets[0];
                    const labelIndex = marketChart.data.labels.indexOf(data.symbol);
                    
                    if (labelIndex !== -1) {
                        dataset.data[labelIndex] = data.price_change_24h || 0;
                        dataset.backgroundColor[labelIndex] = (data.price_change_24h || 0) > 0 ?
                            'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
                        dataset.borderColor[labelIndex] = (data.price_change_24h || 0) > 0 ?
                            '#10b981' : '#ef4444';
                        marketChart.update('none');
                    }
                }
            }

            handleSignalNotification(data) {
                console.log('New signal:', data);
                
                // Add to signals table if it matches current filter
                if (currentFilter === 'all' || currentFilter === data.type) {
                    this.addSignalToTable(data);
                }
                
                // Update signals count
                const signalsCountEl = document.getElementById('signalsCount');
                const currentCount = parseInt(signalsCountEl.textContent) || 0;
                signalsCountEl.textContent = (currentCount + 1) + ' signals';
                
                // Show notification
                this.showSignalNotification(data);
            }

            handleMarketData(data) {
                console.log('Market data:', data);
                // Update market status indicators
                updateLastUpdateTime();
            }

            addSignalToTable(signal) {
                const tbody = document.getElementById('signalsTable');
                
                // Remove "No signals found" message if present
                const noSignalsRow = tbody.querySelector('td[colspan="6"]');
                if (noSignalsRow) {
                    tbody.innerHTML = '';
                }
                
                const row = document.createElement('tr');
                
                const confidence = (signal.confidence_score * 100).toFixed(0);
                const confidenceBadge = confidence >= 70 ? 'badge-success' :
                                      confidence >= 50 ? 'badge-warning' : 'badge-danger';
                
                const sentiment = signal.entity_sentiment || 0;
                const sentimentBadge = sentiment > 0 ? 'badge-success' :
                                      sentiment < 0 ? 'badge-danger' : 'badge-info';
                
                row.innerHTML = \`
                    <td><span class="badge badge-info">\${signal.source}</span></td>
                    <td>\${signal.type.replace('_', ' ')}</td>
                    <td><strong>\${signal.entity_name || signal.entity || 'N/A'}</strong></td>
                    <td><span class="badge \${confidenceBadge}">\${confidence}%</span></td>
                    <td><span class="badge \${sentimentBadge}">\${sentiment > 0 ? '↑' : sentiment < 0 ? '↓' : '→'} \${sentiment.toFixed(2)}</span></td>
                    <td>\${formatTime(signal.timestamp)}</td>
                \`;
                
                // Add to top of table
                tbody.insertBefore(row, tbody.firstChild);
                
                // Limit table to 50 rows
                while (tbody.children.length > 50) {
                    tbody.removeChild(tbody.lastChild);
                }
            }

            showSignalNotification(signal) {
                // Create notification element
                const notification = document.createElement('div');
                notification.className = 'signal-notification';
                notification.innerHTML = \`
                    <div class="notification-content">
                        <strong>New \${signal.type.replace('_', ' ')} Signal</strong><br>
                        \${signal.entity_name || signal.entity || 'N/A'} - \${signal.source}
                    </div>
                    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
                \`;
                
                // Add styles
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 0.5rem;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease-out;
                `;
                
                document.body.appendChild(notification);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 5000);
            }

            updateConnectionStatus(status) {
                const statusDot = document.querySelector('.status-dot');
                const statusText = document.getElementById('lastUpdate');
                
                switch (status) {
                    case 'Connected':
                        statusDot.style.background = '#10b981';
                        statusText.textContent = 'Live (WebSocket)';
                        break;
                    case 'Disconnected':
                        statusDot.style.background = '#ef4444';
                        statusText.textContent = 'Disconnected';
                        break;
                    case 'Error':
                        statusDot.style.background = '#f59e0b';
                        statusText.textContent = 'Connection Error';
                        break;
                    default:
                        statusDot.style.background = '#6b7280';
                        statusText.textContent = 'Connecting...';
                }
            }

            attemptReconnect() {
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(\`Attempting to reconnect (\${this.reconnectAttempts}/\${this.maxReconnectAttempts})\`);
                    
                    setTimeout(() => {
                        this.connect();
                    }, this.reconnectDelay * this.reconnectAttempts);
                } else {
                    console.log('Max reconnection attempts reached');
                    this.updateConnectionStatus('Error');
                }
            }

            disconnect() {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                this.isConnected = false;
            }
        }

        // Initialize dashboard
        async function initDashboard() {
            await loadDashboard();
            startAutoRefresh();
            
            // Initialize WebSocket connection
            wsClient = new CryptoIntelWebSocket();
            wsClient.connect();
        }

        // Load all dashboard data
        async function loadDashboard() {
            try {
                await Promise.all([
                    loadStats(),
                    loadSignals(currentFilter),
                    loadEntities(),
                    loadMarketData(),
                    loadTransactions()
                ]);
                updateLastUpdateTime();
            } catch (error) {
                console.error('Dashboard load error:', error);
            }
        }

        // Load statistics
        async function loadStats() {
            try {
                const response = await fetch('/enhanced-dashboard/api/stats');
                const stats = await response.json();

                document.getElementById('signalsTotal').textContent = stats.signals.total.toLocaleString();
                document.getElementById('revenueTotal').textContent = (stats.transactions.total_revenue || 0).toFixed(4) + ' ETH';
                document.getElementById('usersTotal').textContent = (stats.transactions.unique_users || 0).toLocaleString();

                const marketChange = stats.market.avg_change || 0;
                const marketChangeEl = document.getElementById('marketChange');
                marketChangeEl.textContent = (marketChange > 0 ? '+' : '') + marketChange.toFixed(2) + '%';
                marketChangeEl.className = 'stat-value ' + (marketChange > 0 ? 'trend-up' : 'trend-down');

                // Update charts with stats
                updateSignalsChart(stats.signals.bySource);
                updateEntitiesChart(stats.entities);

            } catch (error) {
                console.error('Stats load error:', error);
            }
        }

        // Load signals with filtering
        async function loadSignals(filter = 'all') {
            try {
                const filterParam = filter === 'all' ? '' : '&type=' + filter;
                const response = await fetch('/enhanced-dashboard/api/signals?limit=50' + filterParam);
                const data = await response.json();

                document.getElementById('signalsCount').textContent = data.count + ' signals';

                const tbody = document.getElementById('signalsTable');
                tbody.innerHTML = '';

                if (data.signals.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="loading">No signals found</td></tr>';
                    return;
                }

                data.signals.forEach(signal => {
                    const row = document.createElement('tr');

                    const confidence = (signal.confidence_score * 100).toFixed(0);
                    const confidenceBadge = confidence >= 70 ? 'badge-success' :
                                          confidence >= 50 ? 'badge-warning' : 'badge-danger';

                    const sentiment = signal.entity_sentiment || 0;
                    const sentimentBadge = sentiment > 0 ? 'badge-success' :
                                          sentiment < 0 ? 'badge-danger' : 'badge-info';

                    row.innerHTML = \`
                        <td><span class="badge badge-info">\${signal.source}</span></td>
                        <td>\${signal.type.replace('_', ' ')}</td>
                        <td><strong>\${signal.entity_name || signal.entity || 'N/A'}</strong></td>
                        <td><span class="badge \${confidenceBadge}">\${confidence}%</span></td>
                        <td><span class="badge \${sentimentBadge}">\${sentiment > 0 ? '↑' : sentiment < 0 ? '↓' : '→'} \${sentiment.toFixed(2)}</span></td>
                        <td>\${formatTime(signal.timestamp)}</td>
                    \`;
                    tbody.appendChild(row);
                });

            } catch (error) {
                console.error('Signals load error:', error);
            }
        }

        // Load entities
        async function loadEntities() {
            try {
                const response = await fetch('/enhanced-dashboard/api/entities?limit=10');
                const data = await response.json();

                const tbody = document.getElementById('entitiesTable');
                tbody.innerHTML = '';

                if (data.entities.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="loading">No entities found</td></tr>';
                    return;
                }

                data.entities.forEach(entity => {
                    const row = document.createElement('tr');
                    const sentiment = entity.avg_sentiment || 0;
                    const sentimentBadge = sentiment > 0 ? 'badge-success' :
                                          sentiment < 0 ? 'badge-danger' : 'badge-info';

                    row.innerHTML = \`
                        <td><strong>\${entity.entity_name}</strong></td>
                        <td><span class="badge badge-info">\${entity.entity_type}</span></td>
                        <td>\${entity.mention_count.toLocaleString()}</td>
                        <td><span class="badge \${sentimentBadge}">\${sentiment.toFixed(2)}</span></td>
                        <td>\${formatTime(entity.last_mention)}</td>
                    \`;
                    tbody.appendChild(row);
                });

            } catch (error) {
                console.error('Entities load error:', error);
            }
        }

        // Load market data
        async function loadMarketData() {
            try {
                const response = await fetch('/enhanced-dashboard/api/market?symbols=BTC,ETH,SOL,MATIC,AVAX');
                const data = await response.json();

                updateMarketChart(data.marketData);

            } catch (error) {
                console.error('Market data load error:', error);
            }
        }

        // Load transaction data
        async function loadTransactions() {
            try {
                const response = await fetch('/enhanced-dashboard/api/transactions?range=7d');
                const data = await response.json();

                updateRevenueChart(data.summary);

            } catch (error) {
                console.error('Transactions load error:', error);
            }
        }

        // Update Signals Chart
        function updateSignalsChart(data) {
            const ctx = document.getElementById('signalsChart').getContext('2d');

            if (signalsChart) {
                signalsChart.destroy();
            }

            signalsChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(s => s.source),
                    datasets: [{
                        data: data.map(s => s.count),
                        backgroundColor: [
                            '#3b82f6',
                            '#10b981',
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                padding: 15
                            }
                        }
                    }
                }
            });
        }

        // Update Market Chart
        function updateMarketChart(data) {
            const ctx = document.getElementById('marketChart').getContext('2d');

            if (marketChart) {
                marketChart.destroy();
            }

            marketChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(m => m.symbol),
                    datasets: [{
                        label: '24h Change %',
                        data: data.map(m => m.avgChange),
                        backgroundColor: data.map(m => m.avgChange > 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'),
                        borderColor: data.map(m => m.avgChange > 0 ? '#10b981' : '#ef4444'),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        },
                        x: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        }
                    }
                }
            });
        }

        // Update Revenue Chart
        function updateRevenueChart(data) {
            const ctx = document.getElementById('revenueChart').getContext('2d');

            if (revenueChart) {
                revenueChart.destroy();
            }

            revenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(t => t.tool_id),
                    datasets: [{
                        label: 'Revenue (ETH)',
                        data: data.map(t => parseFloat(t.total_revenue || 0)),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: '#3b82f6',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        },
                        x: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        }
                    }
                }
            });
        }

        // Update Entities Chart
        function updateEntitiesChart(data) {
            const ctx = document.getElementById('entitiesChart').getContext('2d');

            if (entitiesChart) {
                entitiesChart.destroy();
            }

            entitiesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(e => e.entity_name),
                    datasets: [{
                        label: 'Mentions',
                        data: data.map(e => e.mention_count),
                        backgroundColor: 'rgba(139, 92, 246, 0.5)',
                        borderColor: '#8b5cf6',
                        borderWidth: 2
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        },
                        x: {
                            beginAtZero: true,
                            ticks: { color: '#94a3b8' },
                            grid: { color: '#334155' }
                        }
                    }
                }
            });
        }

        // Filter signals
        function filterSignals(type) {
            currentFilter = type;

            // Update filter buttons
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector('[data-type="' + type + '"]').classList.add('active');

            // Reload signals
            loadSignals(type);
        }

        // Format timestamp
        function formatTime(timestamp) {
            const date = new Date(timestamp * 1000);
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);

            if (diff < 60) return diff + 's ago';
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            return date.toLocaleString();
        }

        // Update last update time
        function updateLastUpdateTime() {
            const now = new Date();
            document.getElementById('lastUpdate').textContent = 'Updated ' + now.toLocaleTimeString();
        }

        // Refresh dashboard
        function refreshDashboard() {
            loadDashboard();
        }

        // Auto-refresh every 30 seconds
        function startAutoRefresh() {
            setInterval(() => {
                loadDashboard();
            }, 30000);
        }

        // Initialize on page load
        window.addEventListener('DOMContentLoaded', initDashboard);
    </script>
</body>
</html>
  `;
}

export default enhancedDashboard;
