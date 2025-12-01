/**
 * CryptoIntel Analytics Dashboard
 * Real-time monitoring and analytics interface for the data gathering system
 * Integrates with x402 transaction intelligence
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const dashboard = new Hono();

// CORS configuration
dashboard.use('/*', cors({
  origin: ['https://tradingmindset.app', 'https://tools-x402-production.magicmike.workers.dev'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Dashboard main endpoint
 */
dashboard.get('/', async (c) => {
  const html = generateDashboardHTML();
  return c.html(html);
});

/**
 * API endpoint for dashboard data
 */
dashboard.get('/api/stats', async (c) => {
  try {
    const stats = await getDashboardStats(c.env);
    return c.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Real-time signals endpoint
 */
dashboard.get('/api/signals', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const type = c.req.query('type');
    
    let query = `
      SELECT s.*, em.entity_name, em.entity_type, em.sentiment_score as entity_sentiment
      FROM signals s
      LEFT JOIN entity_mentions em ON s.id = em.signal_id
      WHERE s.timestamp > ?
    `;
    
    const dayAgoInSeconds = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Last 24 hours
    const params = [dayAgoInSeconds];

    if (type) {
      query += ' AND s.type = ?';
      params.push(type);
    }

    query += ' ORDER BY s.confidence_score DESC, s.timestamp DESC LIMIT ?';
    params.push(limit);

    const signals = await c.env.CRYPTOINTEL_DB.prepare(query).bind(...params).all();
    
    return c.json({
      signals: signals.results || [],
      count: signals.results?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Signals API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Transaction intelligence endpoint
 */
dashboard.get('/api/transactions', async (c) => {
  try {
    const timeRange = c.req.query('range') || '7d';
    const timeRangeMs = getTimeRangeMs(timeRange);
    
    const transactions = await env.CRYPTOINTEL_DB.prepare(`
      SELECT 
        tool_id,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction_value,
        currency,
        DATE(timestamp, 'unixepoch') as date
      FROM transactions
      WHERE status = 'confirmed' AND timestamp > ?
      GROUP BY tool_id, currency, DATE(timestamp, 'unixepoch')
      ORDER BY date DESC
    `).bind(Date.now() - timeRangeMs).all();
    
    const summary = await env.CRYPTOINTEL_DB.prepare(`
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
 * Market analysis endpoint
 */
dashboard.get('/api/market', async (c) => {
  try {
    const symbols = (c.req.query('symbols') || 'BTC,ETH,SOL').split(',');
    
    const marketData = [];
    
    for (const symbol of symbols) {
      const data = await env.CRYPTOINTEL_DB.prepare(`
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
      `).bind(symbol.trim(), Date.now() - (24 * 60 * 60 * 1000)).first();
      
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
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Market API error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * System health endpoint
 */
dashboard.get('/api/health', async (c) => {
  try {
    const health = {
      database: await checkDatabaseHealth(env),
      cache: await checkCacheHealth(env),
      apis: await checkAPIHealth(env),
      uptime: process.uptime ? process.uptime() : 0,
      timestamp: new Date().toISOString()
    };
    
    return c.json(health);
    
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get dashboard statistics
 */
async function getDashboardStats(env) {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  try {
    // Signal stats
    const signalStats = await env.CRYPTOINTEL_DB.prepare(`
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
    
    // Transaction stats
    const transactionStats = await env.CRYPTOINTEL_DB.prepare(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction,
        COUNT(DISTINCT user_wallet) as unique_users
      FROM transactions
      WHERE status = 'confirmed' AND timestamp > ?
    `).bind(weekAgo).first();
    
    // Market data stats
    const marketStats = await env.CRYPTOINTEL_DB.prepare(`
      SELECT 
        COUNT(DISTINCT symbol) as symbols_tracked,
        COUNT(*) as data_points,
        AVG(price_change_24h) as avg_change
      FROM market_data
      WHERE timestamp > ?
    `).bind(dayAgo).first();
    
    // Entity mentions
    const entityStats = await env.CRYPTOINTEL_DB.prepare(`
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
    
    // API usage stats
    const apiStats = await env.CRYPTOINTEL_DB.prepare(`
      SELECT 
        source,
        COUNT(*) as request_count,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code = 200 THEN 1 END) as success_count
      FROM api_usage
      WHERE timestamp > ?
      GROUP BY source
      ORDER BY request_count DESC
    `).bind(dayAgo).all();
    
    return {
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
      apiUsage: apiStats.results || [],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    throw error;
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(env) {
  try {
    const result = await env.CRYPTOINTEL_DB.prepare('SELECT 1 as test').first();
    return {
      status: result?.test === 1 ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Check cache health
 */
async function checkCacheHealth(env) {
  try {
    const testKey = 'health_check_' + Date.now();
    await env.CRYPTOINTEL_CACHE.put(testKey, 'test', { expirationTtl: 60 });
    const value = await env.CRYPTOINTEL_CACHE.get(testKey);
    await env.CRYPTOINTEL_CACHE.delete(testKey);
    
    return {
      status: value === 'test' ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Check external API health
 */
async function checkAPIHealth(env) {
  const apis = ['coingecko', 'coinmarketcap', 'defillama', 'cryptopanic'];
  const results = {};
  
  for (const api of apis) {
    try {
      const startTime = Date.now();
      const response = await fetch(getAPIHealthURL(api), {
        headers: { 'User-Agent': 'CryptoIntel-Health/1.0' }
      });
      const responseTime = Date.now() - startTime;
      
      results[api] = {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: responseTime,
        statusCode: response.status
      };
    } catch (error) {
      results[api] = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  return results;
}

function getAPIHealthURL(api) {
  const urls = {
    coingecko: 'https://api.coingecko.com/api/v3/ping',
    coinmarketcap: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map',
    defillama: 'https://api.llama.fi/protocols',
    cryptopanic: 'https://cryptopanic.com/news/rss'
  };
  return urls[api] || null;
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

/**
 * Generate dashboard HTML
 */
function generateDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CryptoIntel Analytics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .dark { color-scheme: dark; }
        .stat-card { @apply bg-white dark:bg-gray-800 rounded-lg shadow p-6; }
        .trend-up { @apply text-green-600 dark:text-green-400; }
        .trend-down { @apply text-red-600 dark:text-red-400; }
    </style>
</head>
<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <div class="min-h-screen">
        <!-- Header -->
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center">
                        <h1 class="text-2xl font-bold text-blue-600 dark:text-blue-400">CryptoIntel</h1>
                        <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">Analytics Dashboard</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button id="refreshBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                            Refresh
                        </button>
                        <button id="themeToggle" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Stats Overview -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="stat-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Signals Today</p>
                            <p class="text-2xl font-bold" id="signalsCount">-</p>
                        </div>
                        <div class="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Revenue (7d)</p>
                            <p class="text-2xl font-bold" id="revenueCount">-</p>
                        </div>
                        <div class="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                            <p class="text-2xl font-bold" id="usersCount">-</p>
                        </div>
                        <div class="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">System Health</p>
                            <p class="text-2xl font-bold" id="healthStatus">-</p>
                        </div>
                        <div class="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                            <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Signals Chart -->
                <div class="stat-card">
                    <h3 class="text-lg font-semibold mb-4">Signal Sources</h3>
                    <canvas id="signalsChart"></canvas>
                </div>

                <!-- Revenue Chart -->
                <div class="stat-card">
                    <h3 class="text-lg font-semibold mb-4">Revenue Trend</h3>
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>

            <!-- Recent Signals Table -->
            <div class="stat-card">
                <h3 class="text-lg font-semibold mb-4">Recent Signals</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                            </tr>
                        </thead>
                        <tbody id="signalsTable" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            <tr>
                                <td colspan="5" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Loading...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Dark mode toggle
        const themeToggle = document.getElementById('themeToggle');
        const html = document.documentElement;
        
        // Check for saved theme preference
        if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
        }
        
        themeToggle.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
        });

        // Dashboard functionality
        let signalsChart, revenueChart;

        async function loadDashboard() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                updateStats(stats);
                updateCharts(stats);
                updateSignalsTable();
                
            } catch (error) {
                console.error('Dashboard load error:', error);
            }
        }

        function updateStats(stats) {
            document.getElementById('signalsCount').textContent = stats.signals.total || 0;
            document.getElementById('revenueCount').textContent = (stats.transactions.total_revenue || 0).toFixed(4) + ' ETH';
            document.getElementById('usersCount').textContent = stats.transactions.unique_users || 0;
            document.getElementById('healthStatus').textContent = 'Healthy';
        }

        function updateCharts(stats) {
            // Signals Chart
            const signalsCtx = document.getElementById('signalsChart').getContext('2d');
            if (signalsChart) signalsChart.destroy();
            
            signalsChart = new Chart(signalsCtx, {
                type: 'doughnut',
                data: {
                    labels: stats.signals.bySource.map(s => s.source),
                    datasets: [{
                        data: stats.signals.bySource.map(s => s.count),
                        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });

            // Revenue Chart
            const revenueCtx = document.getElementById('revenueChart').getContext('2d');
            if (revenueChart) revenueChart.destroy();
            
            revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Revenue (ETH)',
                        data: [0.001, 0.002, 0.0015, 0.003, 0.0025, 0.001, 0.002],
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        async function updateSignalsTable() {
            try {
                const response = await fetch('/api/signals?limit=10');
                const data = await response.json();
                
                const tbody = document.getElementById('signalsTable');
                tbody.innerHTML = '';
                
                data.signals.forEach(signal => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">\${signal.source}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">\${signal.type}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">\${signal.entity}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                \${(signal.confidence_score * 100).toFixed(0)}%
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            \${new Date(signal.timestamp * 1000).toLocaleTimeString()}
                        </td>
                    \`;
                    tbody.appendChild(row);
                });
                
            } catch (error) {
                console.error('Signals table error:', error);
            }
        }

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

        // Auto-refresh every 30 seconds
        setInterval(loadDashboard, 30000);

        // Initial load
        loadDashboard();
    </script>
</body>
</html>
  `;
}

export default dashboard;