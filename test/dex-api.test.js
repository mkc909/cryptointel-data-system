/**
 * DEX API Integration Tests
 * Tests for CoinMarketCap DEX API v4 integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment for testing
const mockEnv = {
  CRYPTOINTEL_DB: {
    prepare: vi.fn((query) => {
      const mockStatement = {
        bind: vi.fn((params) => {
          const mockBoundStatement = {
            run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 1 } }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null)
          };
          return mockBoundStatement;
        })
      };
      return mockStatement;
    }),
    exec: vi.fn().mockResolvedValue({ success: true })
  },
  CRYPTOINTEL_CACHE: {
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  },
  COINGECKO_API_KEY: 'test-key',
  COINMARKETCAP_API_KEY: 'test-cmc-key'
};

// Import the app after setting up mocks
let app;
beforeEach(async () => {
  // Dynamic import to avoid circular dependencies
  const module = await import('../src/index.js');
  app = module.default;
});

describe('DEX API Integration', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DEX Data Fetching Functions', () => {
    describe('fetchDEXSpotPairs', () => {
      it('should fetch and store DEX pairs successfully', async () => {
        // Mock successful API response
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: 'pair_1',
                name: 'BTC/ETH',
                base_currency_id: 1,
                quote_currency_id: 1027,
                network_id: 'ethereum',
                dex_id: 'uniswap_v3',
                quote: {
                  USD: {
                    price: '45000.00',
                    volume_24h: '1234567890'
                  }
                },
                liquidity: 5000000,
                last_updated: '2024-07-29T14:30:00Z'
              }
            ]
          })
        });

        const req = new Request('https://cryptointel.example.com/dex/pairs');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.source).toBe('coinmarketcap_dex');
        expect(data.data).toBeDefined();
        expect(data.data).toHaveLength(1);
        expect(data.data[0].name).toBe('BTC/ETH');
      });

      it('should handle rate limiting for DEX pairs', async () => {
        // Mock rate limit exceeded
        mockEnv.CRYPTOINTEL_CACHE.get = () => Promise.resolve('300'); // At limit

        const req = new Request('https://cryptointel.example.com/dex/pairs');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.error).toBe('Rate limit exceeded');
      });

      it('should handle API errors gracefully', async () => {
        // Mock API error
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 401
        });

        const req = new Request('https://cryptointel.example.com/dex/pairs');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.error).toBeDefined();
        expect(data.error).toContain('DEX API error');
      });
    });

    describe('fetchDEXNetworks', () => {
      it('should fetch DEX networks successfully', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: 'ethereum',
                name: 'Ethereum',
                chain_id: 1,
                native_currency_id: 1027
              },
              {
                id: 'bsc',
                name: 'Binance Smart Chain',
                chain_id: 56,
                native_currency_id: 1839
              }
            ]
          })
        });

        const req = new Request('https://cryptointel.example.com/dex/networks');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.source).toBe('coinmarketcap_dex');
        expect(data.data).toHaveLength(2);
        expect(data.data[0].name).toBe('Ethereum');
        expect(data.data[1].name).toBe('Binance Smart Chain');
      });
    });

    describe('fetchDEXListings', () => {
      it('should fetch DEX listings successfully', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: 'uniswap_v3',
                name: 'Uniswap V3',
                trust_score: 0.95,
                volume_24h: 250000000,
                number_of_pairs: 1500
              }
            ]
          })
        });

        const req = new Request('https://cryptointel.example.com/dex/listings');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.source).toBe('coinmarketcap_dex');
        expect(data.data).toHaveLength(1);
        expect(data.data[0].name).toBe('Uniswap V3');
      });
    });

    describe('fetchDEXHistorical', () => {
      it('should fetch historical DEX data for a pair', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                timestamp: '2024-07-29T14:00:00Z',
                open: 44000,
                high: 45500,
                low: 43500,
                close: 45000,
                volume: 1234567
              }
            ]
          })
        });

        const req = new Request('https://cryptointel.example.com/dex/historical/pair_1?timeframe=1h');
        const res = await app.fetch(req, mockEnv);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        expect(data.source).toBe('coinmarketcap_dex');
        expect(data.data).toHaveLength(1);
        expect(data.data[0].close).toBe(45000);
      });
    });
  });

  describe('DEX Signal Detection', () => {
    it('should detect volume anomalies', async () => {
      const mockDEXData = {
        id: 'pair_1',
        volume_24h: 2000000,
        avg_volume: 500000,
        dex_id: 'uniswap_v3',
        network_id: 'ethereum'
      };

      // Mock database calls for signal storage
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          run: Promise.resolve({ success: true })
        })
      });

      // Import and test the signal detection function
      const { detectDEXSignals } = await import('../src/index.js');
      const signals = await detectDEXSignals(mockEnv, mockDEXData);

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('dex_volume_anomaly');
      expect(signals[0].confidence_score).toBe(0.85);
      expect(signals[0].details).toContain('Volume spike');
    });

    it('should identify new pairs', async () => {
      const mockDEXData = {
        id: 'new_pair_123',
        name: 'NEW/USDT',
        dex_id: 'new_dex',
        network_id: 'ethereum'
      };

      // Mock database to return no existing pair
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          first: Promise.resolve(null), // No existing pair
          run: Promise.resolve({ success: true })
        })
      });

      const { detectDEXSignals } = await import('../src/index.js');
      const signals = await detectDEXSignals(mockEnv, mockDEXData);

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('dex_new_pair');
      expect(signals[0].confidence_score).toBe(0.95);
      expect(signals[0].details).toContain('New pair listed');
    });

    it('should detect liquidity shifts', async () => {
      const mockDEXData = {
        id: 'pair_1',
        liquidity_change_24h: -25,
        dex_id: 'uniswap_v3',
        network_id: 'ethereum'
      };

      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          run: Promise.resolve({ success: true })
        })
      });

      const { detectDEXSignals } = await import('../src/index.js');
      const signals = await detectDEXSignals(mockEnv, mockDEXData);

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('dex_liquidity_shift');
      expect(signals[0].confidence_score).toBe(0.75);
      expect(signals[0].details).toContain('Liquidity decreased');
    });

    it('should detect price volatility', async () => {
      const mockDEXData = {
        id: 'pair_1',
        price_change_24h: 20,
        dex_id: 'uniswap_v3',
        network_id: 'ethereum'
      };

      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          run: Promise.resolve({ success: true })
        })
      });

      const { detectDEXSignals } = await import('../src/index.js');
      const signals = await detectDEXSignals(mockEnv, mockDEXData);

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('dex_price_volatility');
      expect(signals[0].confidence_score).toBe(0.70);
      expect(signals[0].details).toContain('Price change: 20%');
    });

    it('should detect high volume low liquidity risk', async () => {
      const mockDEXData = {
        id: 'pair_1',
        volume_24h: 2000000,
        liquidity: 30000,
        dex_id: 'uniswap_v3',
        network_id: 'ethereum'
      };

      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          run: Promise.resolve({ success: true })
        })
      });

      const { detectDEXSignals } = await import('../src/index.js');
      const signals = await detectDEXSignals(mockEnv, mockDEXData);

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('dex_liquidity_risk');
      expect(signals[0].confidence_score).toBe(0.80);
      expect(signals[0].details).toContain('High volume');
      expect(signals[0].details).toContain('low liquidity');
    });
  });

  describe('DEX API Endpoints', () => {
    it('GET /dex/pairs returns cached data', async () => {
      // Mock cache hit
      mockEnv.CRYPTOINTEL_CACHE.get = (key) => {
        if (key === 'dex_pairs:latest') {
          return Promise.resolve(JSON.stringify({
            source: 'coinmarketcap_dex',
            data: [{ id: 'pair_1', name: 'BTC/ETH' }],
            cached: true
          }));
        }
        return Promise.resolve(null);
      };

      const req = new Request('https://cryptointel.example.com/dex/pairs');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Cache')).toBe('HIT');
      
      const data = await res.json();
      expect(data.source).toBe('coinmarketcap_dex');
      expect(data.data).toHaveLength(1);
    });

    it('GET /dex/networks returns network data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'ethereum', name: 'Ethereum' }]
        })
      });

      const req = new Request('https://cryptointel.example.com/dex/networks');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.source).toBe('coinmarketcap_dex');
      expect(data.data).toHaveLength(1);
    });

    it('GET /dex/signals returns recent signals', async () => {
      // Mock database response for signals
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          all: () => Promise.resolve({
            results: [
              {
                id: 1,
                signal_type: 'dex_volume_anomaly',
                pair_id: 'pair_1',
                details: 'Volume spike detected',
                confidence_score: 0.85,
                created_at: '2024-07-29T14:30:00Z'
              }
            ]
          })
        })
      });

      const req = new Request('https://cryptointel.example.com/dex/signals?limit=10');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.signals).toHaveLength(1);
      expect(data.signals[0].signal_type).toBe('dex_volume_anomaly');
      expect(data.count).toBe(1);
    });

    it('GET /dex/analysis/:pair_id returns comprehensive analysis', async () => {
      // Mock database responses for analysis
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          first: () => Promise.resolve({
            id: 'pair_1',
            name: 'BTC/ETH',
            volume_24h: 1000000,
            liquidity: 500000,
            network_name: 'Ethereum',
            dex_name: 'Uniswap V3'
          }),
          all: () => Promise.resolve({
            results: [
              {
                signal_type: 'dex_volume_anomaly',
                created_at: '2024-07-29T14:30:00Z'
              }
            ]
          })
        })
      });

      const req = new Request('https://cryptointel.example.com/dex/analysis/pair_1');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.pair).toBeDefined();
      expect(data.pair.name).toBe('BTC/ETH');
      expect(data.signals).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.recommendations).toBeDefined();
      expect(data.last_updated).toBeDefined();
    });

    it('GET /dex/volume-leaders returns top volume pairs', async () => {
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          all: () => Promise.resolve({
            results: [
              {
                id: 'pair_1',
                name: 'BTC/ETH',
                volume_24h: 5000000,
                network_name: 'Ethereum',
                dex_name: 'Uniswap V3'
              },
              {
                id: 'pair_2',
                name: 'ETH/USDT',
                volume_24h: 3000000,
                network_name: 'Ethereum',
                dex_name: 'SushiSwap'
              }
            ]
          })
        })
      });

      const req = new Request('https://cryptointel.example.com/dex/volume-leaders?limit=10');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.leaders).toHaveLength(2);
      expect(data.leaders[0].volume_24h).toBeGreaterThan(data.leaders[1].volume_24h);
      expect(data.count).toBe(2);
    });
  });

  describe('DEX Error Handling', () => {
    it('should handle missing API key', async () => {
      const envWithoutKey = {
        ...mockEnv,
        COINMARKETCAP_API_KEY: null
      };

      const req = new Request('https://cryptointel.example.com/dex/pairs');
      const res = await app.fetch(req, envWithoutKey);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.error).toBe('CoinMarketCap API key not configured');
    });

    it('should handle database errors gracefully', async () => {
      const envWithDBError = {
        ...mockEnv,
        CRYPTOINTEL_DB: {
          prepare: () => {
            throw new Error('Database connection failed');
          }
        }
      };

      const req = new Request('https://cryptointel.example.com/dex/signals');
      const res = await app.fetch(req, envWithDBError);
      
      expect(res.status).toBe(500);
    });

    it('should handle malformed pair ID in analysis', async () => {
      mockEnv.CRYPTOINTEL_DB.prepare = () => ({
        bind: () => ({
          first: () => Promise.resolve(null) // No pair found
        })
      });

      const req = new Request('https://cryptointel.example.com/dex/analysis/invalid_pair');
      const res = await app.fetch(req, mockEnv);
      
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Pair not found');
    });
  });

  describe('DEX Caching Behavior', () => {
    it('should cache DEX pairs for 5 minutes', async () => {
      let cacheKey, cacheTTL;
      
      mockEnv.CRYPTOINTEL_CACHE.put = (key, value, options) => {
        cacheKey = key;
        cacheTTL = options?.expirationTtl;
        return Promise.resolve();
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      });

      const req = new Request('https://cryptointel.example.com/dex/pairs');
      await app.fetch(req, mockEnv);
      
      expect(cacheKey).toBe('dex_pairs:latest');
      expect(cacheTTL).toBe(300); // 5 minutes
    });

    it('should cache DEX networks for 30 minutes', async () => {
      let cacheKey, cacheTTL;
      
      mockEnv.CRYPTOINTEL_CACHE.put = (key, value, options) => {
        cacheKey = key;
        cacheTTL = options?.expirationTtl;
        return Promise.resolve();
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      });

      const req = new Request('https://cryptointel.example.com/dex/networks');
      await app.fetch(req, mockEnv);
      
      expect(cacheKey).toBe('dex_networks:latest');
      expect(cacheTTL).toBe(1800); // 30 minutes
    });
  });
});

// Integration tests for DEX workflow
describe('DEX Integration Tests', () => {
  it('should complete full DEX data collection workflow', async () => {
    // Mock all DEX API calls
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'pair_1', name: 'BTC/ETH', volume_24h: 1000000 }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'ethereum', name: 'Ethereum' }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'uniswap_v3', name: 'Uniswap V3' }]
        })
      });

    // Test all endpoints in sequence
    const pairsReq = new Request('https://cryptointel.example.com/dex/pairs');
    const networksReq = new Request('https://cryptointel.example.com/dex/networks');
    const listingsReq = new Request('https://cryptointel.example.com/dex/listings');

    const [pairsRes, networksRes, listingsRes] = await Promise.all([
      app.fetch(pairsReq, mockEnv),
      app.fetch(networksReq, mockEnv),
      app.fetch(listingsReq, mockEnv)
    ]);

    expect(pairsRes.status).toBe(200);
    expect(networksRes.status).toBe(200);
    expect(listingsRes.status).toBe(200);

    const pairsData = await pairsRes.json();
    const networksData = await networksRes.json();
    const listingsData = await listingsRes.json();

    expect(pairsData.source).toBe('coinmarketcap_dex');
    expect(networksData.source).toBe('coinmarketcap_dex');
    expect(listingsData.source).toBe('coinmarketcap_dex');
  });

  it('should handle DEX signal detection and analysis workflow', async () => {
    // Mock database for signal detection and analysis
    mockEnv.CRYPTOINTEL_DB.prepare = () => ({
      bind: () => ({
        first: () => Promise.resolve({
          id: 'pair_1',
          name: 'BTC/ETH',
          volume_24h: 2000000,
          liquidity: 500000,
          network_name: 'Ethereum',
          dex_name: 'Uniswap V3'
        }),
        all: () => Promise.resolve({
          results: [
            {
              signal_type: 'dex_volume_anomaly',
              created_at: '2024-07-29T14:30:00Z'
            }
          ]
        }),
        run: Promise.resolve({ success: true })
      })
    });

    const analysisReq = new Request('https://cryptointel.example.com/dex/analysis/pair_1');
    const analysisRes = await app.fetch(analysisReq, mockEnv);

    expect(analysisRes.status).toBe(200);

    const analysisData = await analysisRes.json();
    expect(analysisData.pair).toBeDefined();
    expect(analysisData.signals).toBeDefined();
    expect(analysisData.metrics).toBeDefined();
    expect(analysisData.recommendations).toBeDefined();
  });
});