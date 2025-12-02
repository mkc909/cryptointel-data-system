/**
 * DEX Integration End-to-End Tests
 * Tests DEX API integration without requiring actual API key
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Cloudflare Workers environment
global.fetch = vi.fn();

// Mock environment
const mockEnv = {
  CRYPTOINTEL_DB: {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] })
  },
  CRYPTOINTEL_CACHE: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue()
  },
  COINMARKETCAP_API_KEY: 'test-key'
};

// Import DEX functions (using correct export names)
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

describe('DEX Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Configuration', () => {
    it('should have all DEX functions defined', () => {
      expect(typeof fetchDEXSpotPairs).toBe('function');
      expect(typeof fetchDEXNetworks).toBe('function');
      expect(typeof fetchDEXListingsInfo).toBe('function');
      expect(typeof fetchDEXListingsQuotes).toBe('function');
      expect(typeof fetchDEXPairsOHLCVHistorical).toBe('function');
      expect(typeof fetchDEXPairsOHLCVLatest).toBe('function');
      expect(typeof fetchDEXPairsQuotesLatest).toBe('function');
      expect(typeof fetchDEXPairsTradeLatest).toBe('function');
      expect(typeof generateDEXSignals).toBe('function');
    });

    it('should handle missing API key gracefully', async () => {
      // Test without API key
      const envWithoutKey = { ...mockEnv, COINMARKETCAP_API_KEY: undefined };
      
      await expect(fetchDEXSpotPairs(envWithoutKey)).rejects.toThrow();
      await expect(fetchDEXNetworks(envWithoutKey)).rejects.toThrow();
    });

    it('should validate required parameters', async () => {
      // Test missing required parameters
      await expect(fetchDEXPairsOHLCVHistorical(mockEnv, {})).rejects.toThrow();
      await expect(fetchDEXPairsOHLCVHistorical(mockEnv, { pair_id: '123' })).rejects.toThrow();
    });
  });

  describe('API Endpoint Structure', () => {
    it('should construct correct API URLs', async () => {
      // Mock successful API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} })
      });

      await fetchDEXSpotPairs(mockEnv);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://pro-api.coinmarketcap.com/v4/dex/spot/pairs/latest',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CMC_PRO_API_KEY': 'test-key'
          })
        })
      );
    });

    it('should include query parameters correctly', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} })
      });

      await fetchDEXSpotPairs(mockEnv, { limit: 10, network_id: 1 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10&network_id=1'),
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting for DEX endpoints', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} })
      });

      // Make multiple rapid requests
      const promises = Array(5).fill().map(() => fetchDEXSpotPairs(mockEnv));
      await Promise.all(promises);

      // Should have made exactly 5 API calls
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('Caching', () => {
    it('should cache DEX responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { pairs: [] } })
      });

      await fetchDEXSpotPairs(mockEnv);

      // Should have cached the response
      expect(mockEnv.CRYPTOINTEL_CACHE.put).toHaveBeenCalledWith(
        expect.stringContaining('dex_spot_pairs'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 })
      );
    });

    it('should return cached responses when available', async () => {
      // Mock cached response
      mockEnv.CRYPTOINTEL_CACHE.get.mockResolvedValueOnce(JSON.stringify({ data: { pairs: [] } }));

      const result = await fetchDEXSpotPairs(mockEnv);

      expect(result).toEqual({ data: { pairs: [] } });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } })
      });

      await expect(fetchDEXSpotPairs(mockEnv)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchDEXSpotPairs(mockEnv)).rejects.toThrow('Network error');
    });
  });

  describe('Signal Detection', () => {
    it('should detect volume anomalies', async () => {
      const mockPairs = [
        { pair_id: '1', volume_24h: '1000000', volume_24h_change_24h: '500' }, // 500% increase
        { pair_id: '2', volume_24h: '1000000', volume_24h_change_24h: '50' }   // 50% increase
      ];

      const signals = await generateDEXSignals(mockEnv, mockPairs);

      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'volume_anomaly',
            pair_id: '1',
            severity: 'high'
          })
        ])
      );
    });

    it('should detect new pairs', async () => {
      const mockPairs = [
        { pair_id: '1', first_swap_at: '2023-12-01T00:00:00Z' }, // Recent
        { pair_id: '2', first_swap_at: '2021-01-01T00:00:00Z' }  // Old
      ];

      const signals = await generateDEXSignals(mockEnv, mockPairs);

      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'new_pair',
            pair_id: '1',
            severity: 'medium'
          })
        ])
      );
    });
  });

  describe('Database Integration', () => {
    it('should store DEX data in database', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            pairs: [
              {
                pair_id: '1',
                base_token_address: '0x123',
                quote_token_address: '0x456',
                network_id: 1,
                volume_24h: '1000000'
              }
            ]
          }
        })
      });

      await fetchDEXSpotPairs(mockEnv);

      expect(mockEnv.CRYPTOINTEL_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO dex_pairs')
      );
    });
  });
});