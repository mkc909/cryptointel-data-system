/**
 * Crypto Intelligence Dashboard - FREE API Version
 * Real-time analytics and monitoring for crypto signals and market data
 */

import { Hono } from 'hono';
import { html } from 'hono/html';

const dashboard = new Hono();

/**
 * Main intelligence dashboard with dark mode support
 */
dashboard.get('/', async (c) => {
  try {
    // Get signal analytics
    const signalAnalytics = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        source,
        type,
        COUNT(*) as signal_count,
        AVG(confidence) as avg_confidence
      FROM signals
      WHERE timestamp > ?
      GROUP BY source, type
      ORDER BY signal_count DESC
    `).bind(Date.now() - (24 * 60 * 60 * 1000)).all();

    // Get daily signal trend
    const dailySignals = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        DATE(datetime(timestamp, 'unixepoch')) as date,
        COUNT(*) as daily_signals,
        COUNT(DISTINCT source) as active_sources
      FROM signals
      WHERE timestamp > ?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 14
    `).bind(Date.now() - (14 * 24 * 60 * 60 * 1000)).all();

    // Get recent signals
    const recentSignals = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT * FROM signals
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();

    // Get top entities mentioned
    const topEntities = await c.env.CRYPTOINTEL_DB.prepare(`
      SELECT
        entity_name,
        COUNT(*) as mention_count,
        MAX(confidence) as max_confidence
      FROM signals
      WHERE entity_name IS NOT NULL AND entity_name != ''
      GROUP BY entity_name
      ORDER BY mention_count DESC
      LIMIT 5
    `).all();

    // Ensure all data variables are arrays to prevent errors
    const safeSignalAnalytics = Array.isArray(signalAnalytics) ? signalAnalytics : [];
    const safeDailySignals = Array.isArray(dailySignals) ? dailySignals : [];
    const safeRecentSignals = Array.isArray(recentSignals) ? recentSignals : [];
    const safeTopEntities = Array.isArray(topEntities) ? topEntities : [];

    return c.html(html`
<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>x402 Transaction Intelligence Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#eff6ff',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              900: '#1e3a8a'
            }
          }
        }
      }
    }
  </script>
</head>
<body class="h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  <div class="min-h-full">
    <!-- Navigation -->
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">x402 Intelligence</h1>
          </div>
          <div class="flex items-center space-x-4">
            <button id="refreshBtn" class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors">
              Refresh
            </button>
            <button id="darkModeToggle" class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-primary-100 dark:bg-primary-900 rounded-md p-3">
              <svg class="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Signals</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  ${(() => {
                    console.log('DEBUG: About to call reduce on safeSignalAnalytics');
                    console.log('DEBUG: safeSignalAnalytics:', safeSignalAnalytics);
                    console.log('DEBUG: typeof safeSignalAnalytics:', typeof safeSignalAnalytics);
                    console.log('DEBUG: Array.isArray(safeSignalAnalytics):', Array.isArray(safeSignalAnalytics));
                    try {
                      const result = (safeSignalAnalytics || []).reduce((sum, a) => sum + parseInt(a.signal_count || 0), 0);
                      console.log('DEBUG: reduce result:', result);
                      return result;
                    } catch (error) {
                      console.log('DEBUG: reduce error:', error);
                      return 0;
                    }
                  })()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-green-100 dark:bg-green-900 rounded-md p-3">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Signal Sources</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">${(safeSignalAnalytics || []).length}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-purple-100 dark:bg-purple-900 rounded-md p-3">
              <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg Confidence</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">
                  ${((safeSignalAnalytics || []).reduce((sum, a) => sum + parseFloat(a.avg_confidence || 0), 0) / Math.max((safeSignalAnalytics || []).length, 1)).toFixed(2)}%
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 rounded-md p-3">
              <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Sources</dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-white">${(safeDailySignals || []).length}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Signals by Source -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Signals by Source</h3>
          <canvas id="revenueChart" width="400" height="200"></canvas>
        </div>

        <!-- Daily Signal Trend -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Daily Signal Trend</h3>
          <canvas id="trendChart" width="400" height="200"></canvas>
        </div>
      </div>

      <!-- Tables Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Signals -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Signals</h3>
          </div>
          <div class="overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Source</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                ${(safeRecentSignals || []).map(signal => html`
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${signal.source}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${signal.type}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${new Date(signal.timestamp).toLocaleString()}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Entities -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Entities</h3>
          </div>
          <div class="overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entity</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mentions</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Confidence</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                ${(safeTopEntities || []).map(entity => html`
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${entity.entity_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${entity.mention_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${(entity.max_confidence * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    const html = document.documentElement;
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('dark');
    }
    
    darkModeToggle.addEventListener('click', () => {
      html.classList.toggle('dark');
      localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    });

    // Signals by Source Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    new Chart(revenueCtx, {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify((safeSignalAnalytics || []).map(a => a.source))},
        datasets: [{
          data: ${JSON.stringify((safeSignalAnalytics || []).map(a => parseInt(a.signal_count || 0)))},
          backgroundColor: [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: () => document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151'
            }
          }
        }
      }
    });

    // Daily Signal Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify((safeDailySignals || []).map(d => d.date))},
        datasets: [{
          label: 'Daily Signals',
          data: ${JSON.stringify((safeDailySignals || []).map(d => parseInt(d.daily_signals || 0)))},
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: () => document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: () => document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151'
            },
            grid: {
              color: () => document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
            }
          },
          y: {
            ticks: {
              color: () => document.documentElement.classList.contains('dark') ? '#9ca3af' : '#374151'
            },
            grid: {
              color: () => document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
            }
          }
        }
      }
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      window.location.reload();
    });
  </script>
</body>
</html>
    `);

  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: error.message }, { status: 500 });
  }
});

export default dashboard;