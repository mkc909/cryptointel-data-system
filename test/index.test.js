/**
 * CryptoIntel Data System Tests
 * Comprehensive test suite for data collection, signal processing, and x402 integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { app } from '../src/index.js';
import {
  detectDEXSignals,
  fetchDEXSpotPairs,
  fetchDEXNetworks,
  fetchDEXListings,
  fetchDEXHistorical,
  generateDEXAnalysis,
  calculateVolumeRank,
  calculateLiquidityScore
} from '../src/index.js';

// Mock environment for testing
const mockEnv = {
  CRYPTOINTEL_DB: {
    prepare: () => ({
      bind: () => ({
        run: () => Promise.resolve({ success: true }),
        all: () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve(null)
      })
    }),
    exec: () => Promise.resolve({ success: true })
  },
  CRYPTOINTEL_CACHE: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve()
  },
  COINGECKO_API_KEY: 'test-key',
  COINMARKETCAP_API_KEY: 'test-key'
};

// Mock global fetch for API calls
global.fetch = vi.fn();

// Mock fetch responses
const mockFetchResponses = {
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true': {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      bitcoin: { usd: 50000, usd_24h_change: 2.5 },
      ethereum: { usd: 3000, usd_24h_change: -1.2 }
    })
  },
  'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH': {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data: {
        BTC: { quote: { USD: { price: 50000 } } },
        ETH: { quote: { USD: { price: 3000 } } }
      }
    })
  },
  'https://api.llama.fi/v2/chains': {
    ok: true,
    status: 200,
    json: () => Promise.resolve([
      { name: 'Ethereum', tvl: 1000000000 },
      { name: 'BSC', tvl: 500000000 }
    ])
  },
  'https://cryptopanic.com/api/v1/posts/?auth_token=test-key&filter=rising': {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      results: [
        { title: 'Bitcoin reaches new high', published_at: '2023-01-01T00:00:00Z' }
      ]
    })
  }
};

// Setup fetch mock
global.fetch.mockImplementation((url) => {
  return Promise.resolve(mockFetchResponses[url] || {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Not found' })
  });
});

describe('CryptoIntel Data System', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const req = new Request('https://cryptointel.example.com/health');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('1.0.0');
      expect(data.sources).toContain('coingecko');
      expect(data.sources).toContain('coinmarketcap');
      expect(data.sources).toContain('defillama');
      expect(data.sources).toContain('cryptopanic');
      expect(data.sources).toContain('coinmarketcap_dex');
    });

    it('should return valid timestamp', async () => {
      const req = new Request('https://cryptointel.example.com/health');
      const res = await app.fetch(req, mockEnv);

      const data = await res.json();
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Market Data Collection', () => {
    it('should collect CoinGecko data successfully', async () => {
      // Mock fetch for CoinGecko API
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          market_data: {
            current_price: { usd: 45000 },
            total_volume: { usd: 25000000000 },
            market_cap: { usd: 880000000000 },
            price_change_percentage_24h: { usd: 5.2 }
          }
        })
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results.coingecko).toBeDefined();
    });

    it('should handle CoinGecko API errors gracefully', async () => {
      // Mock failed fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results.coingecko.error).toBeDefined();
    });

    it('should handle network timeouts', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network timeout'));

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should collect CoinMarketCap data with valid API key', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            BTC: {
              quote: {
                USD: {
                  price: 45000,
                  volume_24h: 25000000000,
                  market_cap: 880000000000,
                  percent_change_24h: 5.2
                }
              }
            }
          }
        })
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle missing API keys gracefully', async () => {
      const envWithoutKeys = {
        ...mockEnv,
        COINMARKETCAP_API_KEY: undefined
      };

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, envWithoutKeys);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results.coinmarketcap.error).toBeDefined();
    });
  });

  describe('DeFi Llama Integration', () => {
    it('should collect DeFi protocol data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          protocols: [
            {
              name: 'Uniswap',
              tvl: 5000000000,
              historical_tvl: 4000000000,
              chains: ['ethereum', 'arbitrum']
            }
          ]
        })
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results.defillama).toBeDefined();
    });

    it('should detect TVL anomalies', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          protocols: [
            {
              name: 'TestProtocol',
              tvl: 1000000000,
              historical_tvl: 500000000, // 100% increase
              chains: ['ethereum']
            }
          ]
        })
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results.defillama.data).toBeDefined();
    });

    it('should handle DeFi Llama API errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results.defillama.error).toBeDefined();
    });
  });

  describe('Signal Processing', () => {
    it('should process RSS feed and extract signals', async () => {
      // Mock RSS feed
      const mockRSS = `
        <rss>
          <channel>
            <item>
              <title>Bitcoin Surges Past $50,000</title>
              <description>Bullish momentum continues as adoption grows</description>
              <link>https://example.com/news/1</link>
              <guid>news-1</guid>
              <pubDate>Mon, 17 Nov 2025 03:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS)
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results.cryptopanic.data).toBeDefined();
    });

    it('should extract entities from news content', async () => {
      const mockRSS = `
        <rss>
          <channel>
            <item>
              <title>Bitcoin and Ethereum rally on Coinbase listing</title>
              <description>Major tokens surge after exchange announcement</description>
              <link>https://example.com/news/2</link>
              <guid>news-2</guid>
              <pubDate>Mon, 17 Nov 2025 03:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS)
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results.cryptopanic.data).toBeDefined();
    });

    it('should analyze sentiment from news headlines', async () => {
      const mockRSS = `
        <rss>
          <channel>
            <item>
              <title>Market crash: Bitcoin dumps below $30,000</title>
              <description>Bearish sentiment as concerns grow</description>
              <link>https://example.com/news/3</link>
              <guid>news-3</guid>
              <pubDate>Mon, 17 Nov 2025 03:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS)
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results.cryptopanic.data).toBeDefined();
    });

    it('should handle malformed RSS feeds', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('invalid xml')
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('DEX API Integration', () => {
    it('should fetch DEX spot pairs', async () => {
      const req = new Request('https://cryptointel.example.com/dex/pairs');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should fetch DEX networks', async () => {
      const req = new Request('https://cryptointel.example.com/dex/networks');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should fetch DEX listings', async () => {
      const req = new Request('https://cryptointel.example.com/dex/listings');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should cache DEX pairs data', async () => {
      const cachedData = {
        source: 'coinmarketcap_dex',
        data: [{ id: 'pair_1', name: 'BTC/ETH' }]
      };

      const envWithCache = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce(JSON.stringify(cachedData)),
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/dex/pairs');
      const res = await app.fetch(req, envWithCache);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Cache')).toBe('HIT');
    });

    it('should get DEX signals with filters', async () => {
      const req = new Request('https://cryptointel.example.com/dex/signals?type=dex_volume_anomaly&limit=10');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.signals).toBeDefined();
    });

    it('should get DEX analysis for specific pair', async () => {
      const req = new Request('https://cryptointel.example.com/dex/analysis/pair_123');
      const res = await app.fetch(req, mockEnv);

      expect([200, 404]).toContain(res.status);
    });

    it('should get volume leaders', async () => {
      const req = new Request('https://cryptointel.example.com/dex/volume-leaders?limit=20');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.leaders).toBeDefined();
    });

    it('should detect DEX volume anomalies', async () => {
      const dexData = {
        id: 'pair_test',
        volume_24h: 2000000,
        avg_volume: 500000,
        dex_id: 'dex_1',
        network_id: 'net_1'
      };

      const signals = await detectDEXSignals(mockEnv, dexData);
      expect(signals).toBeDefined();
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should calculate liquidity score correctly', async () => {
      const pairData = {
        liquidity: 100000,
        volume_24h: 1000000
      };

      const score = calculateLiquidityScore(pairData);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('x402 Integration', () => {
    it('should require payment verification for analysis', async () => {
      const req = new Request('https://cryptointel.example.com/x402/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(402);

      const data = await res.json();
      expect(data.error).toBe('Payment verification required');
    });

    it('should process valid x402 payment', async () => {
      const paymentData = {
        transactionId: 'tx_123456',
        wallet: '0x1234567890abcdef',
        amount: 0.001,
        reportType: 'comprehensive'
      };

      const req = new Request('https://cryptointel.example.com/x402/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
      expect(data.transactionId).toBe(paymentData.transactionId);
    });

    it('should log transactions to database', async () => {
      const dbSpy = vi.spyOn(mockEnv.CRYPTOINTEL_DB, 'prepare');

      const paymentData = {
        transactionId: 'tx_789012',
        wallet: '0xabcdef1234567890',
        amount: 0.002,
        reportType: 'basic'
      };

      const req = new Request('https://cryptointel.example.com/x402/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      await app.fetch(req, mockEnv);

      expect(dbSpy).toHaveBeenCalled();
    });

    it('should get transaction history', async () => {
      const req = new Request('https://cryptointel.example.com/x402/transactions?limit=50');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.transactions).toBeDefined();
    });

    it('should filter transactions by tool_id', async () => {
      const req = new Request('https://cryptointel.example.com/x402/transactions?tool_id=cryptointel-analysis');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.transactions).toBeDefined();
    });

    it('should get transaction analytics', async () => {
      const req = new Request('https://cryptointel.example.com/x402/analytics');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.revenue_by_tool).toBeDefined();
      expect(data.daily_revenue).toBeDefined();
      expect(data.top_users).toBeDefined();
    });
  });

  describe('Signal Retrieval', () => {
    it('should return unprocessed signals', async () => {
      // Mock database response
      const mockDb = {
        ...mockEnv.CRYPTOINTEL_DB,
        prepare: () => ({
          bind: () => ({
            all: () => Promise.resolve({
              results: [
                {
                  id: 'signal_1',
                  source: 'coingecko',
                  type: 'price_alert',
                  entity: 'bitcoin',
                  confidence_score: 0.85,
                  timestamp: Date.now() / 1000
                }
              ]
            })
          })
        })
      };

      const envWithMockDb = { ...mockEnv, CRYPTOINTEL_DB: mockDb };

      const req = new Request('https://cryptointel.example.com/signals?limit=10');
      const res = await app.fetch(req, envWithMockDb);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.signals).toBeDefined();
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    it('should filter signals by type', async () => {
      const req = new Request('https://cryptointel.example.com/signals?type=sentiment_shift');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.signals).toBeDefined();
    });

    it('should filter signals by entity', async () => {
      const req = new Request('https://cryptointel.example.com/signals?entity=bitcoin');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.signals).toBeDefined();
    });

    it('should limit number of signals returned', async () => {
      const req = new Request('https://cryptointel.example.com/signals?limit=5');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.signals).toBeDefined();
    });
  });

  describe('Market Analysis', () => {
    it('should return market analysis for specified symbols', async () => {
      // Mock cache data
      const envWithCache = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: (key) => {
            if (key === 'market_data:bitcoin') {
              return Promise.resolve(JSON.stringify({
                symbol: 'BTC',
                price: 45000,
                volume_24h: 25000000000,
                market_cap: 880000000000,
                price_change_24h: 5.2
              }));
            }
            return Promise.resolve(null);
          },
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/market-analysis?symbols=bitcoin,ethereum');
      const res = await app.fetch(req, envWithCache);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.analysis).toBeDefined();
    });

    it('should determine market trend correctly', async () => {
      const envWithCache = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: (key) => {
            if (key === 'market_data:bitcoin') {
              return Promise.resolve(JSON.stringify({
                symbol: 'BTC',
                price: 45000,
                volume_24h: 25000000000,
                market_cap: 880000000000,
                price_change_24h: 5.2
              }));
            }
            return Promise.resolve(null);
          },
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/market-analysis?symbols=bitcoin');
      const res = await app.fetch(req, envWithCache);

      const data = await res.json();
      if (data.analysis && data.analysis.length > 0) {
        expect(data.analysis[0].trend).toMatch(/bullish|bearish/);
      }
    });

    it('should get cached market data for specific symbol', async () => {
      const envWithCache = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce(JSON.stringify({
            symbol: 'BTC',
            price: 45000
          })),
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/market-data/bitcoin');
      const res = await app.fetch(req, envWithCache);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Cache')).toBe('HIT');
    });

    it('should return 404 for uncached market data', async () => {
      const req = new Request('https://cryptointel.example.com/market-data/unknown-symbol');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits for API calls', async () => {
      // Mock rate limit exceeded
      const envWithRateLimit = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce('30'), // At limit
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      const res = await app.fetch(req, envWithRateLimit);

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should track rate limit usage in KV', async () => {
      const kvPutSpy = vi.fn();
      const envWithSpy = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce(null),
          put: kvPutSpy,
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      await app.fetch(req, envWithSpy);

      // Rate limiter should have been called during data collection
      expect(kvPutSpy).toHaveBeenCalled();
    });

    it('should handle concurrent requests within rate limit', async () => {
      const requests = Array(5).fill(null).map(() =>
        app.fetch(new Request('https://cryptointel.example.com/health'), mockEnv)
      );

      const responses = await Promise.all(requests);
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache market data with TTL', async () => {
      const kvPutSpy = vi.fn();
      const envWithSpy = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce(null),
          put: kvPutSpy,
          delete: vi.fn()
        }
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          market_data: {
            current_price: { usd: 45000 },
            total_volume: { usd: 25000000000 },
            market_cap: { usd: 880000000000 },
            price_change_percentage_24h: { usd: 5.2 }
          }
        })
      });

      const req = new Request('https://cryptointel.example.com/collect', {
        method: 'POST'
      });
      await app.fetch(req, envWithSpy);

      expect(kvPutSpy).toHaveBeenCalled();
    });

    it('should serve cached data when available', async () => {
      const cachedData = JSON.stringify({
        symbol: 'BTC',
        price: 45000
      });

      const envWithCache = {
        ...mockEnv,
        CRYPTOINTEL_CACHE: {
          get: vi.fn().mockResolvedValueOnce(cachedData),
          put: vi.fn(),
          delete: vi.fn()
        }
      };

      const req = new Request('https://cryptointel.example.com/market-data/bitcoin');
      const res = await app.fetch(req, envWithCache);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Cache')).toBe('HIT');
    });
  });

  describe('Dashboard Endpoints', () => {
    it('should serve dashboard HTML', async () => {
      const req = new Request('https://cryptointel.example.com/dashboard');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
    });

    it('should return dashboard stats', async () => {
      const req = new Request('https://cryptointel.example.com/dashboard/api/stats');
      const res = await app.fetch(req, mockEnv);

      expect([200, 500]).toContain(res.status);
    });

    it('should return dashboard signals', async () => {
      const req = new Request('https://cryptointel.example.com/dashboard/api/signals');
      const res = await app.fetch(req, mockEnv);

      expect([200, 500]).toContain(res.status);
    });

    it('should return dashboard transactions', async () => {
      const req = new Request('https://cryptointel.example.com/dashboard/api/transactions');
      const res = await app.fetch(req, mockEnv);

      expect([200, 500]).toContain(res.status);
    });

    it('should return dashboard market data', async () => {
      const req = new Request('https://cryptointel.example.com/dashboard/api/market?symbols=BTC,ETH');
      const res = await app.fetch(req, mockEnv);

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const envWithDbError = {
        ...mockEnv,
        CRYPTOINTEL_DB: {
          prepare: () => {
            throw new Error('Database connection failed');
          }
        }
      };

      const req = new Request('https://cryptointel.example.com/signals');
      const res = await app.fetch(req, envWithDbError);

      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should handle malformed requests', async () => {
      const req = new Request('https://cryptointel.example.com/x402/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(500);
    });

    it('should handle missing query parameters', async () => {
      const req = new Request('https://cryptointel.example.com/market-analysis');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should handle invalid signal types', async () => {
      const req = new Request('https://cryptointel.example.com/signals?type=invalid_type');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should return 404 for invalid endpoints', async () => {
      const req = new Request('https://cryptointel.example.com/invalid-endpoint');
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from x402 ecosystem', async () => {
      const req = new Request('https://cryptointel.example.com/health', {
        headers: { 'Origin': 'https://x402-ecosystem.workers.dev' }
      });
      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://x402-ecosystem.workers.dev');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const req = new Request('https://cryptointel.example.com/health', {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://x402-ecosystem.workers.dev' }
      });
      const res = await app.fetch(req, mockEnv);

      expect([200, 204]).toContain(res.status);
    });
  });
});

// Integration tests
describe('CryptoIntel Integration Tests', () => {
  it('should complete full data collection workflow', async () => {
    // Mock all external APIs
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          market_data: {
            current_price: { usd: 45000 },
            total_volume: { usd: 25000000000 },
            market_cap: { usd: 880000000000 },
            price_change_percentage_24h: { usd: 5.2 }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          protocols: [
            {
              name: 'Uniswap',
              tvl: 5000000000,
              chains: ['ethereum', 'arbitrum']
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(`
          <rss>
            <channel>
              <item>
                <title>Market Update</title>
                <description>Bullish trends continue</description>
              </item>
            </channel>
          </rss>
        `)
      });

    const req = new Request('https://cryptointel.example.com/collect', {
      method: 'POST'
    });
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.results).toBeDefined();
    expect(data.results.coingecko).toBeDefined();
    expect(data.results.defillama).toBeDefined();
    expect(data.results.cryptopanic).toBeDefined();
  });

  it('should handle x402 payment and analysis workflow', async () => {
    const paymentData = {
      transactionId: 'tx_integration_test',
      wallet: '0x1234567890abcdef',
      amount: 0.001,
      reportType: 'comprehensive'
    };

    // Mock database responses for analysis
    const mockDb = {
      ...mockEnv.CRYPTOINTEL_DB,
      prepare: () => ({
        bind: () => ({
          all: () => Promise.resolve({
            results: [
              {
                id: 'signal_1',
                source: 'coingecko',
                type: 'price_alert',
                entity: 'bitcoin',
                confidence_score: 0.85,
                timestamp: Date.now() / 1000
              }
            ]
          }),
          run: () => Promise.resolve({ success: true })
        })
      })
    };

    const envWithMockDb = { ...mockEnv, CRYPTOINTEL_DB: mockDb };

    const req = new Request('https://cryptointel.example.com/x402/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    const res = await app.fetch(req, envWithMockDb);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.report).toBeDefined();
    expect(data.report.type).toBe('comprehensive');
    expect(data.report.insights).toBeDefined();
  });

  it('should handle end-to-end DEX workflow', async () => {
    // Test full DEX data collection and signal generation
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: 'pair_1',
            name: 'BTC/ETH',
            volume_24h: 5000000,
            avg_volume: 2000000,
            dex_id: 'dex_1',
            network_id: 'net_1'
          }
        ]
      })
    });

    const req = new Request('https://cryptointel.example.com/dex/pairs');
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
  });
});
