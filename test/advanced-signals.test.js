/**
 * Advanced Signal Detection Tests
 * Tests for compound signals, cross-source validation, temporal patterns, and ML-based detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedSignalDetector, ADVANCED_SIGNALS, CONFIDENCE_WEIGHTS, SOURCE_RELIABILITY } from '../src/advanced-signals.js';

describe('Advanced Signal Detection', () => {
  let detector;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
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
      }
    };
    detector = new AdvancedSignalDetector(mockEnv);
  });

  describe('AdvancedSignalDetector Initialization', () => {
    it('should initialize with environment', () => {
      expect(detector.env).toBe(mockEnv);
      expect(detector.patternCache).toBeInstanceOf(Map);
      expect(detector.correlationCache).toBeInstanceOf(Map);
    });
  });

  describe('Compound Signal Detection', () => {
    it('should detect whale accumulation signals', async () => {
      const signals = [
        {
          id: 'vol_1',
          type: 'volume_anomaly',
          source: 'coingecko',
          entity: 'bitcoin',
          confidence_score: 0.8,
          timestamp: Math.floor(Date.now() / 1000) - 1000,
          data: JSON.stringify({
            volume_ratio: 3.5,
            price_change_24h: 15
          })
        },
        {
          id: 'dex_1',
          type: 'volume_anomaly',
          source: 'dex',
          entity: 'bitcoin',
          confidence_score: 0.7,
          timestamp: Math.floor(Date.now() / 1000) - 500,
          data: JSON.stringify({
            volume_ratio: 2.8,
            price_change_24h: 12
          })
        }
      ];

      const compoundSignals = await detector.detectCompoundSignals(signals);
      
      expect(compoundSignals).toHaveLength(1);
      expect(compoundSignals[0].signal_type).toBe('whale_accumulation');
      expect(compoundSignals[0].entities).toContain('bitcoin');
      expect(compoundSignals[0].confidence_score).toBeGreaterThan(0.5);
    });

    it('should detect breakout patterns', async () => {
      const signals = [
        {
          id: 'vol_1',
          type: 'volume_anomaly',
          source: 'binance',
          entity: 'ethereum',
          confidence_score: 0.9,
          timestamp: Math.floor(Date.now() / 1000) - 800,
          data: JSON.stringify({
            volume_ratio: 4.2,
            price_change_24h: 18
          })
        },
        {
          id: 'price_1',
          type: 'price_alert',
          source: 'coingecko',
          entity: 'ethereum',
          confidence_score: 0.85,
          timestamp: Math.floor(Date.now() / 1000) - 400,
          data: JSON.stringify({
            price_change_24h: 22,
            direction: 'up'
          })
        }
      ];

      const compoundSignals = await detector.detectCompoundSignals(signals);
      
      expect(compoundSignals).toHaveLength(1);
      expect(compoundSignals[0].signal_type).toBe('breakout_pattern');
      expect(compoundSignals[0].entities).toContain('ethereum');
    });

    it('should detect social momentum signals', async () => {
      const signals = [
        {
          id: 'sentiment_1',
          type: 'sentiment_shift',
          source: 'cryptopanic',
          entity: 'solana',
          confidence_score: 0.7,
          timestamp: Math.floor(Date.now() / 1000) - 600,
          data: JSON.stringify({
            sentiment: 'bullish',
            sentiment_change: 0.8
          })
        },
        {
          id: 'news_1',
          type: 'entity_mentions',
          source: 'cryptopanic',
          entity: 'solana',
          confidence_score: 0.6,
          timestamp: Math.floor(Date.now() / 1000) - 300,
          data: JSON.stringify({
            mention_count: 15,
            sentiment: 'positive'
          })
        }
      ];

      const compoundSignals = await detector.detectCompoundSignals(signals);
      
      expect(compoundSignals).toHaveLength(1);
      expect(compoundSignals[0].signal_type).toBe('social_momentum');
      expect(compoundSignals[0].entities).toContain('solana');
    });

    it('should not generate compound signals with insufficient data', async () => {
      const signals = [
        {
          id: 'vol_1',
          type: 'volume_anomaly',
          source: 'coingecko',
          entity: 'bitcoin',
          confidence_score: 0.8,
          timestamp: Math.floor(Date.now() / 1000) - 1000,
          data: JSON.stringify({
            volume_ratio: 1.5, // Too low
            price_change_24h: 5 // Too low
          })
        }
      ];

      const compoundSignals = await detector.detectCompoundSignals(signals);
      
      expect(compoundSignals).toHaveLength(0);
    });
  });

  describe('Cross-Source Validation', () => {
    it('should calculate high validation score for multiple sources', async () => {
      const signals = [
        { source: 'coingecko' },
        { source: 'binance' },
        { source: 'defillama' }
      ];

      const validationScore = await detector.calculateCrossSourceValidation(signals);
      
      expect(validationScore).toBeGreaterThan(0.7);
    });

    it('should calculate low validation score for single source', async () => {
      const signals = [
        { source: 'coingecko' }
      ];

      const validationScore = await detector.calculateCrossSourceValidation(signals);
      
      expect(validationScore).toBe(0.3);
    });

    it('should boost validation score for high-reliability sources', async () => {
      const signals = [
        { source: 'coinmarketcap' },
        { source: 'coingecko' }
      ];

      const validationScore = await detector.calculateCrossSourceValidation(signals);
      
      expect(validationScore).toBeGreaterThan(0.6);
    });
  });

  describe('Enhanced Confidence Scoring', () => {
    it('should calculate enhanced confidence with multiple factors', () => {
      const baseConfidence = 0.7;
      const signalType = 'whale_accumulation';
      const signals = [
        { source: 'coingecko' },
        { source: 'binance' }
      ];

      const enhancedConfidence = detector.calculateEnhancedConfidence(
        baseConfidence, signalType, signals
      );

      expect(enhancedConfidence).toBeGreaterThan(0);
      expect(enhancedConfidence).toBeLessThanOrEqual(1.0);
    });

    it('should weight source reliability appropriately', () => {
      const highReliabilitySignals = [
        { source: 'coinmarketcap' }
      ];
      const lowReliabilitySignals = [
        { source: 'unknown_source' }
      ];

      const highConfidence = detector.calculateEnhancedConfidence(
        0.5, 'test', highReliabilitySignals
      );
      const lowConfidence = detector.calculateEnhancedConfidence(
        0.5, 'test', lowReliabilitySignals
      );

      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });
  });

  describe('Temporal Pattern Analysis', () => {
    it('should detect cyclical patterns', async () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const signals = [
        {
          id: '1',
          type: 'volume_anomaly',
          entity: 'bitcoin',
          timestamp: baseTime - 3600, // 1 hour ago
        },
        {
          id: '2',
          type: 'volume_anomaly',
          entity: 'bitcoin',
          timestamp: baseTime - 7200, // 2 hours ago
        },
        {
          id: '3',
          type: 'volume_anomaly',
          entity: 'bitcoin',
          timestamp: baseTime - 10800, // 3 hours ago
        }
      ];

      const patterns = await detector.analyzeTemporalPatterns('bitcoin', signals);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern_type).toBe('cyclical');
      expect(patterns[0].confidence_score).toBeGreaterThan(0.5);
    });

    it('should not detect patterns with insufficient data', async () => {
      const signals = [
        {
          id: '1',
          type: 'volume_anomaly',
          entity: 'bitcoin',
          timestamp: Math.floor(Date.now() / 1000) - 1000
        }
      ];

      const patterns = await detector.analyzeTemporalPatterns('bitcoin', signals);
      
      expect(patterns).toHaveLength(0);
    });
  });

  describe('Signal Performance Tracking', () => {
    it('should update performance metrics for correct predictions', async () => {
      mockEnv.CRYPTOINTEL_DB.first.mockResolvedValue({
        total_count: 10,
        true_positives: 7,
        false_positives: 3
      });

      await detector.updateSignalPerformance('volume_anomaly', 'coingecko', true);

      expect(mockEnv.CRYPTOINTEL_DB.prepare).toHaveBeenCalled();
      expect(mockEnv.CRYPTOINTEL_DB.run).toHaveBeenCalled();
    });

    it('should update performance metrics for incorrect predictions', async () => {
      mockEnv.CRYPTOINTEL_DB.first.mockResolvedValue({
        total_count: 10,
        true_positives: 7,
        false_positives: 3
      });

      await detector.updateSignalPerformance('price_alert', 'binance', false);

      expect(mockEnv.CRYPTOINTEL_DB.prepare).toHaveBeenCalled();
      expect(mockEnv.CRYPTOINTEL_DB.run).toHaveBeenCalled();
    });

    it('should handle new signal types', async () => {
      mockEnv.CRYPTOINTEL_DB.first.mockResolvedValue(null);

      await detector.updateSignalPerformance('new_signal_type', 'new_source', true);

      expect(mockEnv.CRYPTOINTEL_DB.prepare).toHaveBeenCalled();
    });
  });

  describe('Signal Grouping', () => {
    it('should group signals by entity correctly', () => {
      const signals = [
        { entity: 'bitcoin, ethereum', timestamp: Math.floor(Date.now() / 1000) - 1000 },
        { entity: 'bitcoin', timestamp: Math.floor(Date.now() / 1000) - 500 },
        { entity: 'ethereum', timestamp: Math.floor(Date.now() / 1000) - 200 },
        { entity: 'solana', timestamp: Math.floor(Date.now() / 1000) - 3000 } // Too old
      ];

      const windowStart = Math.floor(Date.now() / 1000) - 3600;
      const grouped = detector.groupSignalsByEntity(signals, windowStart);

      expect(grouped.has('bitcoin')).toBe(true);
      expect(grouped.has('ethereum')).toBe(true);
      expect(grouped.has('solana')).toBe(false);
      expect(grouped.get('bitcoin')).toHaveLength(2);
      expect(grouped.get('ethereum')).toHaveLength(2);
    });
  });

  describe('Constants and Configuration', () => {
    it('should have defined advanced signal types', () => {
      expect(ADVANCED_SIGNALS).toBeDefined();
      expect(ADVANCED_SIGNALS.whale_accumulation).toBeDefined();
      expect(ADVANCED_SIGNALS.breakout_pattern).toBeDefined();
      expect(ADVANCED_SIGNALS.social_momentum).toBeDefined();
      expect(ADVANCED_SIGNALS.liquidity_cascade).toBeDefined();
      expect(ADVANCED_SIGNALS.risk_reversal).toBeDefined();
    });

    it('should have confidence weight configuration', () => {
      expect(CONFIDENCE_WEIGHTS).toBeDefined();
      expect(CONFIDENCE_WEIGHTS.source_reliability).toBe(0.3);
      expect(CONFIDENCE_WEIGHTS.pattern_match_score).toBe(0.3);
      expect(CONFIDENCE_WEIGHTS.historical_accuracy).toBe(0.2);
      expect(CONFIDENCE_WEIGHTS.entity_reputation).toBe(0.1);
      expect(CONFIDENCE_WEIGHTS.time_relevance).toBe(0.1);
    });

    it('should have source reliability scores', () => {
      expect(SOURCE_RELIABILITY).toBeDefined();
      expect(SOURCE_RELIABILITY.coinmarketcap).toBe(0.90);
      expect(SOURCE_RELIABILITY.coingecko).toBe(0.85);
      expect(SOURCE_RELIABILITY.binance).toBe(0.85);
      expect(SOURCE_RELIABILITY.defillama).toBe(0.80);
      expect(SOURCE_RELIABILITY.cryptopanic).toBe(0.70);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockEnv.CRYPTOINTEL_DB.run.mockRejectedValue(new Error('Database error'));

      const signals = [
        {
          id: 'test',
          type: 'volume_anomaly',
          source: 'test',
          entity: 'test',
          confidence_score: 0.8,
          timestamp: Math.floor(Date.now() / 1000),
          data: '{}'
        }
      ];

      // Should not throw error
      const result = await detector.detectCompoundSignals(signals);
      expect(result).toEqual([]);
    });

    it('should handle malformed signal data', async () => {
      const signals = [
        {
          id: 'test',
          type: 'volume_anomaly',
          source: 'test',
          entity: 'test',
          confidence_score: 0.8,
          timestamp: Math.floor(Date.now() / 1000),
          data: 'invalid json'
        }
      ];

      // Should not throw error
      const result = await detector.detectCompoundSignals(signals);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Mathematical Calculations', () => {
    it('should calculate standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = detector.calculateStandardDeviation(values);
      
      // Expected standard deviation for this dataset is 2
      expect(stdDev).toBeCloseTo(2, 1);
    });

    it('should handle empty array for standard deviation', () => {
      const stdDev = detector.calculateStandardDeviation([]);
      expect(stdDev).toBeNaN();
    });

    it('should handle single value for standard deviation', () => {
      const stdDev = detector.calculateStandardDeviation([5]);
      expect(stdDev).toBe(0);
    });
  });
});