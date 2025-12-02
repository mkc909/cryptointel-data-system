/**
 * DEX API Unit Tests
 * Tests for CoinMarketCap DEX API v4 integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchDEXSpotPairs,
  fetchDEXNetworks,
  fetchDEXListingsQuotes,
  fetchDEXPairsOHLCVHistorical,
  fetchDEXPairsQuotesLatest,
  fetchDEXPairsOHLCVLatest,
  fetchDEXPairsTradeLatest,
  fetchDEXListingsInfo,
  generateDEXSignals,
  getDEXConfig,
  RateLimiter
} from '../src/index.js';

// Mock environment
const mockEnv = {
  COINMARKETCAP_API_KEY: 'test-api-key',
  CRYPTOINTEL_DB: {
    prepare: () => ({
      bind: () => ({ run: () => Promise.resolve() })
    })
  },
  CRYPTOINTEL_CACHE: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve()
  }
};

// Mock fetch globally
global.fetch = vi.fn();

describe('DEX API Configuration', () => {
  it('should return correct DEX configuration', () => {
    const config = getDEXConfig();
    
    expect(config).toBeDefined();
    expect(config.baseURL).toBe('https://pro-api.coinmarketcap.com');
    expect(config.version).toBe('v4');
    expect(config.rateLimit.requests).toBe(300);
    expect(config.rateLimit.window).toBe(60000);
    expect(config.endpoints.spotPairs).toBe('/dex/spot-pairs/latest');
    expect(config.endpoints.networks).toBe('/dex/networks/list');
    expect(config.endpoints.listings).toBe('/dex/listings/quotes');
    expect(config.endpoints.ohlcvHistorical).toBe('/dex/pairs/ohlcv/historical');
    expect(config.endpoints.quotesLatest).toBe('/dex/pairs/quotes/latest');
    expect(config.endpoints.ohlcvLatest).toBe('/dex/pairs/ohlcv/latest');
    expect(config.endpoints.tradeLatest).toBe('/dex/pairs/trade/latest');
    expect(config.endpoints.listingsInfo).toBe('/dex/listings/info');
  });
});

describe('Rate Limiter', () => {
  let rateLimiter;
  let mockCache;

  beforeEach(() => {
    mockCache = {
      get: vi.fn(),
      put: vi.fn()
    };
    rateLimiter = new RateLimiter(mockCache, 300, 60000);
  });

  it('should allow requests within limit', async () => {
    mockCache.get.mockResolvedValue(null);
    
    const result = await rateLimiter.checkLimit('test_key');
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeDefined();
    expect(mockCache.put).toHaveBeenCalled();
  });

  it('should deny requests when limit exceeded', async () => {
    const now = Date.now();
    mockCache.get.mockResolvedValue('300'); // At limit
    
    const result = await rateLimiter.checkLimit('test_key');
    
    expect(result.allowed).toBe(false);
    expect(result.resetTime).toBeGreaterThanOrEqual(now);
  });

  it('should clean old requests from cache', async () => {
    mockCache.get.mockResolvedValue('1'); // Low count
    
    const result = await rateLimiter.checkLimit('test_key');
    
    expect(result.allowed).toBe(true);
    expect(mockCache.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    );
  });
});

describe('DEX API Functions', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('fetchDEXSpotPairs', () => {
    it('should fetch DEX spot pairs successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 1,
              name: 'BTC/ETH',
              base_currency_id: 1,
              quote_currency_id: 1027,
              network_id: 1,
              dex_id: 1,
              quote: {
                USD: {
                  price: 0.05,
                  volume_24h: 1000000,
                  percent_change_24h: 5.2
                }
              },
              liquidity: 500000,
              last_updated: '2025-12-01T22:00:00Z'
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXSpotPairs(mockEnv, 10);

      expect(result.source).toBe('coinmarketcap_dex_spot_pairs');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        pair_id: '1',
        name: 'BTC/ETH',
        base_currency_id: 1,
        quote_currency_id: 1027,
        network_id: '1',
        dex_id: '1',
        price: 0.05,
        volume_24h: 1000000,
        liquidity: 500000,
        price_change_24h: 5.2
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dex/spot-pairs/latest?limit=10'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CMC_PRO_API_KEY': 'test-api-key',
            'Accept': 'application/json',
            'User-Agent': 'CryptoIntel-Data/2.0.0'
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 429
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXSpotPairs(mockEnv);

      expect(result.source).toBe('coinmarketcap_dex');
      expect(result.data).toEqual([]);
      expect(result.error).toBe('API error: 429');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchDEXSpotPairs(mockEnv);

      expect(result.source).toBe('coinmarketcap_dex_spot_pairs');
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Network error');
    });
  });

  describe('fetchDEXNetworks', () => {
    it('should fetch DEX networks successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 1,
              name: 'Ethereum',
              symbol: 'ETH',
              chain_id: 1,
              native_currency_id: 1027,
              is_active: true
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXNetworks(mockEnv);

      expect(result.source).toBe('coinmarketcap_dex_networks');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        network_id: 1,
        name: 'Ethereum',
        symbol: 'ETH',
        chain_id: 1,
        native_currency_id: 1027,
        is_active: true
      });
    });
  });

  describe('fetchDEXListingsQuotes', () => {
    it('should fetch DEX listings successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 1,
              name: 'Uniswap V2',
              website_url: 'https://uniswap.org',
              description: 'Decentralized exchange',
              quote: {
                USD: {
                  volume_24h: 50000000
                }
              },
              market_share_percent: 15.5,
              number_of_pairs: 1000,
              is_active: true
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXListingsQuotes(mockEnv, 5);

      expect(result.source).toBe('coinmarketcap_dex_listings');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        dex_id: '1',
        name: 'Uniswap V2',
        website: 'https://uniswap.org',
        description: 'Decentralized exchange',
        volume_24h: 50000000,
        market_share: 15.5,
        number_of_pairs: 1000,
        is_active: true
      });
    });
  });

  describe('fetchDEXPairsOHLCVHistorical', () => {
    it('should fetch OHLCV historical data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              pair_id: '1',
              time_open: 1701388800,
              quote: {
                USD: {
                  open: 0.05,
                  high: 0.06,
                  low: 0.04,
                  close: 0.055,
                  volume: 100000
                }
              }
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXPairsOHLCVHistorical(mockEnv, '1', '1701388800', '1701475200', '1h');

      expect(result.source).toBe('coinmarketcap_dex_ohlcv');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        pair_id: '1',
        timestamp: 1701388800,
        open_price: 0.05,
        high_price: 0.06,
        low_price: 0.04,
        close_price: 0.055,
        volume: 100000,
        period: '1h'
      });
    });
  });

  describe('fetchDEXPairsQuotesLatest', () => {
    it('should fetch latest quotes successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 1,
              name: 'BTC/ETH',
              quote: {
                USD: {
                  price: 0.055,
                  volume_24h: 1200000,
                  market_cap: 100000000,
                  percent_change_24h: 5.5
                }
              }
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXPairsQuotesLatest(mockEnv, ['1']);

      expect(result.source).toBe('coinmarketcap_dex_quotes_latest');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        pair_id: '1',
        name: 'BTC/ETH',
        price: 0.055,
        volume_24h: 1200000,
        market_cap: 100000000,
        price_change_24h: 5.5
      });
    });
  });

  describe('fetchDEXPairsOHLCVLatest', () => {
    it('should fetch latest OHLCV data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              pair_id: '1',
              time_open: 1701475200,
              quote: {
                USD: {
                  open: 0.055,
                  high: 0.065,
                  low: 0.045,
                  close: 0.06,
                  volume: 150000
                }
              }
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXPairsOHLCVLatest(mockEnv, ['1'], '1h');

      expect(result.source).toBe('coinmarketcap_dex_ohlcv_latest');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        pair_id: '1',
        period: '1h',
        open_price: 0.055,
        high_price: 0.065,
        low_price: 0.045,
        close_price: 0.06,
        volume: 150000
      });
    });
  });

  describe('fetchDEXPairsTradeLatest', () => {
    it('should fetch latest trades successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'trade_123',
              pair_id: '1',
              transaction_id: 'tx_456',
              type: 'buy',
              amount: 1.5,
              price: 0.055,
              total: 0.0825,
              timestamp: 1701475200
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXPairsTradeLatest(mockEnv, ['1'], 50);

      expect(result.source).toBe('coinmarketcap_dex_trade_latest');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'cmc_dex_trade_trade_123',
        pair_id: '1',
        transaction_id: 'tx_456',
        type: 'buy',
        amount: 1.5,
        price: 0.055,
        total: 0.0825,
        timestamp: 1701475200
      });
    });
  });

  describe('fetchDEXListingsInfo', () => {
    it('should fetch DEX listings info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 1,
              name: 'Uniswap V2',
              website_url: 'https://uniswap.org',
              description: 'Leading decentralized exchange',
              logo_url: 'https://example.com/logo.png',
              categories: ['DeFi', 'DEX'],
              networks: [1, 56],
              quote: {
                USD: {
                  volume_24h: 50000000
                }
              },
              market_share_percent: 15.5,
              number_of_pairs: 1000,
              is_active: true,
              date_created: '2020-11-01T00:00:00Z'
            }
          ]
        })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchDEXListingsInfo(mockEnv, ['1']);

      expect(result.source).toBe('coinmarketcap_dex_listings_info');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        dex_id: '1',
        name: 'Uniswap V2',
        website: 'https://uniswap.org',
        description: 'Leading decentralized exchange',
        logo_url: 'https://example.com/logo.png',
        categories: ['DeFi', 'DEX'],
        networks: [1, 56],
        volume_24h: 50000000,
        market_share: 15.5,
        number_of_pairs: 1000,
        is_active: true
      });
    });
  });
});

describe('DEX Signal Generation', () => {
  it('should generate volume anomaly signals', async () => {
    const mockData = [
      {
        pair_id: '1',
        name: 'BTC/ETH',
        volume_24h: 2000000, // > $1M threshold
        dex_id: '1'
      }
    ];

    const signals = await generateDEXSignals(mockEnv, mockData, 'spot_pairs');

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      source: 'coinmarketcap_dex',
      type: 'dex_volume_anomaly',
      entity: 'BTC/ETH',
      confidence_score: expect.any(Number),
      processed: false
    });
  });

  it('should generate price spike signals', async () => {
    const mockData = [
      {
        pair_id: '1',
        name: 'BTC/ETH',
        price_change_24h: 25, // > 20% threshold
        dex_id: '1'
      }
    ];

    const signals = await generateDEXSignals(mockEnv, mockData, 'spot_pairs');

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      source: 'coinmarketcap_dex',
      type: 'dex_price_spike',
      entity: 'BTC/ETH',
      confidence_score: expect.any(Number),
      processed: false
    });
  });

  it('should generate new pair signals', async () => {
    const recentTime = new Date().toISOString();
    const mockData = [
      {
        pair_id: '1',
        name: 'NEW/PAIR',
        last_updated: recentTime
      }
    ];

    const signals = await generateDEXSignals(mockEnv, mockData, 'spot_pairs');

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      source: 'coinmarketcap_dex',
      type: 'dex_new_pair',
      entity: 'NEW/PAIR',
      confidence_score: 0.9,
      processed: false
    });
  });

  it('should not generate signals for normal data', async () => {
    const mockData = [
      {
        pair_id: '1',
        name: 'BTC/ETH',
        volume_24h: 500000, // Below $1M threshold
        price_change_24h: 5, // Below 20% threshold
        last_updated: '2025-11-01T00:00:00Z' // Old data
      }
    ];

    const signals = await generateDEXSignals(mockEnv, mockData, 'spot_pairs');

    expect(signals).toHaveLength(0);
  });
});

describe('Integration Tests', () => {
  it('should handle rate limiting across multiple calls', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: [] })
    };
    fetch.mockResolvedValue(mockResponse);

    // Make multiple calls to test rate limiting
    const promises = Array(5).fill().map(() => fetchDEXSpotPairs(mockEnv, 10));
    const results = await Promise.all(promises);

    // All should succeed since we're below the rate limit
    results.forEach(result => {
      expect(result.source).toBe('coinmarketcap_dex_spot_pairs');
      expect(result.data).toBeDefined();
    });
  });

  it('should cache responses appropriately', async () => {
    const mockCache = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn()
    };
    const envWithCache = { ...mockEnv, CRYPTOINTEL_CACHE: mockCache };

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        data: [{ id: 1, name: 'BTC/ETH' }]
      })
    };
    fetch.mockResolvedValue(mockResponse);

    await fetchDEXSpotPairs(envWithCache, 10);

    // Verify caching was called
    expect(mockCache.put).toHaveBeenCalledWith(
      expect.stringContaining('dex_pair:1'),
      expect.any(String),
      expect.objectContaining({ expirationTtl: 300 })
    );
  });
});