/**
 * Advanced Signal Detection Module
 * Implements compound signals, cross-source validation, temporal patterns, and ML-based detection
 */

// Advanced signal types configuration
const ADVANCED_SIGNALS = {
  // Compound Signals
  'whale_accumulation': {
    sources: ['coingecko', 'defillama', 'dex'],
    confidence_weight: 0.9,
    description: 'Large holder accumulation detected across multiple sources'
  },
  'breakout_pattern': {
    sources: ['market_data', 'volume_analysis'],
    confidence_weight: 0.85,
    description: 'Price breakout with volume confirmation'
  },
  'social_momentum': {
    sources: ['cryptopanic', 'entity_mentions'],
    confidence_weight: 0.7,
    description: 'Social media momentum driving price action'
  },
  'liquidity_cascade': {
    sources: ['dex', 'defillama'],
    confidence_weight: 0.8,
    description: 'Liquidity movement across DeFi protocols'
  },
  'risk_reversal': {
    sources: ['sentiment', 'price_action'],
    confidence_weight: 0.75,
    description: 'Risk sentiment reversal pattern detected'
  }
};

// Confidence scoring formula components
const CONFIDENCE_WEIGHTS = {
  source_reliability: 0.3,
  pattern_match_score: 0.3,
  historical_accuracy: 0.2,
  entity_reputation: 0.1,
  time_relevance: 0.1
};

// Source reliability scores
const SOURCE_RELIABILITY = {
  'coingecko': 0.85,
  'coinmarketcap': 0.90,
  'defillama': 0.80,
  'cryptopanic': 0.70,
  'binance': 0.85,
  'kraken': 0.80,
  'dex': 0.75,
  'system': 0.95
};

/**
 * Advanced Signal Detection Engine
 */
class AdvancedSignalDetector {
  constructor(env) {
    this.env = env;
    this.patternCache = new Map();
    this.correlationCache = new Map();
  }

  /**
   * Detect compound signals from multiple sources
   */
  async detectCompoundSignals(signals, timeWindow = 3600) {
    const compoundSignals = [];
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - timeWindow;

    try {
      // Group signals by entity and time window
      const entitySignals = this.groupSignalsByEntity(signals, windowStart);
      
      for (const [entity, entitySignalList] of entitySignals) {
        // Detect whale accumulation
        const whaleSignal = await this.detectWhaleAccumulation(entity, entitySignalList);
        if (whaleSignal) compoundSignals.push(whaleSignal);

        // Detect breakout patterns
        const breakoutSignal = await this.detectBreakoutPattern(entity, entitySignalList);
        if (breakoutSignal) compoundSignals.push(breakoutSignal);

        // Detect social momentum
        const socialSignal = await this.detectSocialMomentum(entity, entitySignalList);
        if (socialSignal) compoundSignals.push(socialSignal);

        // Detect liquidity cascades
        const liquiditySignal = await this.detectLiquidityCascade(entity, entitySignalList);
        if (liquiditySignal) compoundSignals.push(liquiditySignal);

        // Detect risk reversals
        const riskSignal = await this.detectRiskReversal(entity, entitySignalList);
        if (riskSignal) compoundSignals.push(riskSignal);
      }

      // Store compound signals
      for (const signal of compoundSignals) {
        await this.storeCompoundSignal(signal);
      }

      console.log(`Detected ${compoundSignals.length} compound signals`);
      return compoundSignals;

    } catch (error) {
      console.error('Error detecting compound signals:', error);
      return [];
    }
  }

  /**
   * Detect whale accumulation patterns
   */
  async detectWhaleAccumulation(entity, signals) {
    const volumeSignals = signals.filter(s => s.type === 'volume_anomaly');
    const priceSignals = signals.filter(s => s.type === 'price_alert');
    const dexSignals = signals.filter(s => s.source === 'dex');

    if (volumeSignals.length === 0 || dexSignals.length === 0) return null;

    // Check for multiple volume anomalies with positive price movement
    const positiveVolumeSignals = volumeSignals.filter(s => {
      const data = JSON.parse(s.data || '{}');
      return data.price_change_24h > 0;
    });

    if (positiveVolumeSignals.length < 2) return null;

    const avgConfidence = [...volumeSignals, ...dexSignals]
      .reduce((sum, s) => sum + s.confidence_score, 0) / (volumeSignals.length + dexSignals.length);

    const confidence = this.calculateEnhancedConfidence(
      avgConfidence,
      'whale_accumulation',
      signals
    );

    return {
      id: `whale_accumulation_${entity}_${Date.now()}`,
      component_signals: signals.map(s => s.id),
      signal_type: 'whale_accumulation',
      entities: [entity],
      confidence_score: confidence,
      validation_score: await this.calculateCrossSourceValidation(signals),
      metadata: JSON.stringify({
        volume_signals: volumeSignals.length,
        dex_signals: dexSignals.length,
        positive_volume_ratio: positiveVolumeSignals.length / volumeSignals.length,
        sources: [...new Set(signals.map(s => s.source))]
      }),
      timestamp: Math.floor(Date.now() / 1000),
      processed: false
    };
  }

  /**
   * Detect breakout patterns
   */
  async detectBreakoutPattern(entity, signals) {
    const volumeSignals = signals.filter(s => s.type === 'volume_anomaly');
    const priceSignals = signals.filter(s => s.type === 'price_alert');

    if (volumeSignals.length === 0 || priceSignals.length === 0) return null;

    // Look for volume spike followed by price breakout
    const volumeData = volumeSignals.map(s => JSON.parse(s.data || '{}'));
    const priceData = priceSignals.map(s => JSON.parse(s.data || '{}'));

    const avgVolumeIncrease = volumeData.reduce((sum, d) => 
      sum + (d.volume_ratio || 1), 0) / volumeData.length;
    
    const avgPriceChange = priceData.reduce((sum, d) => 
      sum + Math.abs(d.price_change_24h || 0), 0) / priceData.length;

    if (avgVolumeIncrease < 2.0 || avgPriceChange < 10) return null;

    const confidence = this.calculateEnhancedConfidence(
      Math.min(0.9, (avgVolumeIncrease / 5) * (avgPriceChange / 20)),
      'breakout_pattern',
      signals
    );

    return {
      id: `breakout_pattern_${entity}_${Date.now()}`,
      component_signals: signals.map(s => s.id),
      signal_type: 'breakout_pattern',
      entities: [entity],
      confidence_score: confidence,
      validation_score: await this.calculateCrossSourceValidation(signals),
      metadata: JSON.stringify({
        avg_volume_increase: avgVolumeIncrease,
        avg_price_change: avgPriceChange,
        breakout_strength: (avgVolumeIncrease * avgPriceChange) / 100
      }),
      timestamp: Math.floor(Date.now() / 1000),
      processed: false
    };
  }

  /**
   * Detect social momentum
   */
  async detectSocialMomentum(entity, signals) {
    const sentimentSignals = signals.filter(s => s.type === 'sentiment_shift');
    const newsSignals = signals.filter(s => s.source === 'cryptopanic');
    const entityMentions = signals.filter(s => s.entity.includes(entity));

    if (sentimentSignals.length === 0 && newsSignals.length === 0) return null;

    const totalMentions = entityMentions.length;
    const positiveSentiment = sentimentSignals.filter(s => {
      const data = JSON.parse(s.data || '{}');
      return data.sentiment === 'bullish' || data.sentiment > 0;
    }).length;

    const sentimentRatio = sentimentSignals.length > 0 ? positiveSentiment / sentimentSignals.length : 0.5;
    const mentionScore = Math.min(1.0, totalMentions / 10); // Normalize to 0-1

    if (totalMentions < 3 || sentimentRatio < 0.6) return null;

    const confidence = this.calculateEnhancedConfidence(
      (sentimentRatio * 0.6 + mentionScore * 0.4),
      'social_momentum',
      signals
    );

    return {
      id: `social_momentum_${entity}_${Date.now()}`,
      component_signals: signals.map(s => s.id),
      signal_type: 'social_momentum',
      entities: [entity],
      confidence_score: confidence,
      validation_score: await this.calculateCrossSourceValidation(signals),
      metadata: JSON.stringify({
        total_mentions: totalMentions,
        sentiment_ratio: sentimentRatio,
        mention_score: mentionScore,
        news_signals: newsSignals.length
      }),
      timestamp: Math.floor(Date.now() / 1000),
      processed: false
    };
  }

  /**
   * Detect liquidity cascades
   */
  async detectLiquidityCascade(entity, signals) {
    const dexSignals = signals.filter(s => s.source === 'dex');
    const defiSignals = signals.filter(s => s.source === 'defillama');
    const tvlSignals = signals.filter(s => s.type === 'tvl_anomaly');

    if (dexSignals.length === 0 || defiSignals.length === 0) return null;

    // Look for coordinated liquidity movements
    const liquidityMovements = [...dexSignals, ...tvlSignals];
    const avgLiquidityChange = liquidityMovements.reduce((sum, s) => {
      const data = JSON.parse(s.data || '{}');
      return sum + Math.abs(data.change_percent || 0);
    }, 0) / liquidityMovements.length;

    if (avgLiquidityChange < 20) return null;

    const confidence = this.calculateEnhancedConfidence(
      Math.min(0.9, avgLiquidityChange / 50),
      'liquidity_cascade',
      signals
    );

    return {
      id: `liquidity_cascade_${entity}_${Date.now()}`,
      component_signals: signals.map(s => s.id),
      signal_type: 'liquidity_cascade',
      entities: [entity],
      confidence_score: confidence,
      validation_score: await this.calculateCrossSourceValidation(signals),
      metadata: JSON.stringify({
        avg_liquidity_change: avgLiquidityChange,
        dex_signals: dexSignals.length,
        defi_signals: defiSignals.length,
        tvl_signals: tvlSignals.length
      }),
      timestamp: Math.floor(Date.now() / 1000),
      processed: false
    };
  }

  /**
   * Detect risk reversals
   */
  async detectRiskReversal(entity, signals) {
    const sentimentSignals = signals.filter(s => s.type === 'sentiment_shift');
    const priceSignals = signals.filter(s => s.type === 'price_alert');

    if (sentimentSignals.length === 0 || priceSignals.length === 0) return null;

    // Look for sentiment reversal with price confirmation
    const sentimentData = sentimentSignals.map(s => JSON.parse(s.data || '{}'));
    const priceData = priceSignals.map(s => JSON.parse(s.data || '{}'));

    const sentimentChanges = sentimentData.map(d => d.sentiment_change || 0);
    const priceChanges = priceData.map(d => d.price_change_24h || 0);

    const avgSentimentChange = sentimentChanges.reduce((sum, c) => sum + Math.abs(c), 0) / sentimentChanges.length;
    const avgPriceChange = priceChanges.reduce((sum, c) => sum + Math.abs(c), 0) / priceChanges.length;

    if (avgSentimentChange < 0.5 || avgPriceChange < 8) return null;

    const confidence = this.calculateEnhancedConfidence(
      Math.min(0.9, (avgSentimentChange * avgPriceChange) / 20),
      'risk_reversal',
      signals
    );

    return {
      id: `risk_reversal_${entity}_${Date.now()}`,
      component_signals: signals.map(s => s.id),
      signal_type: 'risk_reversal',
      entities: [entity],
      confidence_score: confidence,
      validation_score: await this.calculateCrossSourceValidation(signals),
      metadata: JSON.stringify({
        avg_sentiment_change: avgSentimentChange,
        avg_price_change: avgPriceChange,
        reversal_strength: (avgSentimentChange * avgPriceChange) / 10
      }),
      timestamp: Math.floor(Date.now() / 1000),
      processed: false
    };
  }

  /**
   * Calculate enhanced confidence score
   */
  calculateEnhancedConfidence(baseConfidence, signalType, signals) {
    const sources = [...new Set(signals.map(s => s.source))];
    const avgSourceReliability = sources.reduce((sum, source) => 
      sum + (SOURCE_RELIABILITY[source] || 0.5), 0) / sources.length;

    const sourceReliabilityScore = avgSourceReliability * CONFIDENCE_WEIGHTS.source_reliability;
    const patternMatchScore = baseConfidence * CONFIDENCE_WEIGHTS.pattern_match_score;
    const historicalAccuracyScore = 0.7 * CONFIDENCE_WEIGHTS.historical_accuracy; // Default historical accuracy
    const entityReputationScore = 0.8 * CONFIDENCE_WEIGHTS.entity_reputation; // Default entity reputation
    const timeRelevanceScore = 0.9 * CONFIDENCE_WEIGHTS.time_relevance; // Recent signals are more relevant

    return Math.min(1.0, 
      sourceReliabilityScore + 
      patternMatchScore + 
      historicalAccuracyScore + 
      entityReputationScore + 
      timeRelevanceScore
    );
  }

  /**
   * Calculate cross-source validation score
   */
  async calculateCrossSourceValidation(signals) {
    const sources = [...new Set(signals.map(s => s.source))];
    const sourceCount = sources.length;
    
    if (sourceCount < 2) return 0.3; // Low validation for single source

    // Higher validation for more diverse sources
    let validationScore = 0.5 + (sourceCount - 1) * 0.15;
    
    // Bonus for high-reliability sources
    const hasHighReliability = sources.some(s => SOURCE_RELIABILITY[s] >= 0.85);
    if (hasHighReliability) validationScore += 0.1;

    return Math.min(1.0, validationScore);
  }

  /**
   * Group signals by entity within time window
   */
  groupSignalsByEntity(signals, windowStart) {
    const entitySignals = new Map();
    
    for (const signal of signals) {
      if (signal.timestamp < windowStart) continue;
      
      const entities = signal.entity.split(', ').map(e => e.trim().toLowerCase());
      for (const entity of entities) {
        if (!entitySignals.has(entity)) {
          entitySignals.set(entity, []);
        }
        entitySignals.get(entity).push(signal);
      }
    }
    
    return entitySignals;
  }

  /**
   * Store compound signal in database
   */
  async storeCompoundSignal(signal) {
    try {
      await this.env.CRYPTOINTEL_DB.prepare(`
        INSERT OR REPLACE INTO compound_signals 
        (id, component_signals, signal_type, entities, confidence_score, validation_score, metadata, timestamp, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.id,
        JSON.stringify(signal.component_signals),
        signal.signal_type,
        JSON.stringify(signal.entities),
        signal.confidence_score,
        signal.validation_score,
        signal.metadata,
        signal.timestamp,
        signal.processed ? 1 : 0
      ).run();

      console.log(`Stored compound signal: ${signal.signal_type} for ${signal.entities.join(', ')}`);
    } catch (error) {
      console.error('Error storing compound signal:', error);
    }
  }

  /**
   * Analyze temporal patterns
   */
  async analyzeTemporalPatterns(entity, signals, timeWindows = [3600, 14400, 86400]) {
    const patterns = [];
    
    for (const window of timeWindows) {
      const windowSignals = signals.filter(s => s.timestamp > Math.floor(Date.now() / 1000) - window);
      
      if (windowSignals.length < 3) continue;
      
      const pattern = await this.detectTemporalPattern(entity, windowSignals, window);
      if (pattern) patterns.push(pattern);
    }
    
    return patterns;
  }

  /**
   * Detect specific temporal pattern
   */
  async detectTemporalPattern(entity, signals, timeWindow) {
    // Analyze signal frequency and timing
    const signalTypes = {};
    const timestamps = signals.map(s => s.timestamp).sort();
    
    for (const signal of signals) {
      signalTypes[signal.type] = (signalTypes[signal.type] || 0) + 1;
    }
    
    // Check for cyclical patterns
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const patternConsistency = 1 - (this.calculateStandardDeviation(intervals) / avgInterval);
    
    if (patternConsistency > 0.7) {
      return {
        pattern_name: `${entity}_cyclical_${timeWindow}`,
        pattern_type: 'cyclical',
        entities: [entity],
        time_window: timeWindow,
        pattern_data: JSON.stringify({
          signal_types: signalTypes,
          avg_interval: avgInterval,
          consistency: patternConsistency,
          signal_count: signals.length
        }),
        confidence_score: patternConsistency * 0.8,
        success_rate: 0.0, // Will be updated with backtesting
        last_detected: Math.max(...timestamps),
        detection_count: signals.length
      };
    }
    
    return null;
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Update signal performance metrics
   */
  async updateSignalPerformance(signalType, source, wasCorrect) {
    try {
      const existing = await this.env.CRYPTOINTEL_DB.prepare(`
        SELECT * FROM signal_performance WHERE signal_type = ? AND source = ?
      `).bind(signalType, source).first();

      if (existing) {
        const newTotal = existing.total_count + 1;
        const newTruePositives = wasCorrect ? existing.true_positives + 1 : existing.true_positives;
        const newFalsePositives = wasCorrect ? existing.false_positives : existing.false_positives + 1;
        
        const newAccuracy = newTruePositives / newTotal;
        const newPrecision = newTruePositives / (newTruePositives + newFalsePositives);
        const newRecall = newTruePositives / newTotal; // Simplified recall
        const newF1 = 2 * (newPrecision * newRecall) / (newPrecision + newRecall);

        await this.env.CRYPTOINTEL_DB.prepare(`
          UPDATE signal_performance 
          SET accuracy_rate = ?, avg_confidence = ?, total_count = ?, 
              true_positives = ?, false_positives = ?, precision_score = ?, 
              recall_score = ?, f1_score = ?, updated_at = CURRENT_TIMESTAMP
          WHERE signal_type = ? AND source = ?
        `).bind(
          newAccuracy, existing.avg_confidence, newTotal, newTruePositives, 
          newFalsePositives, newPrecision, newRecall, newF1, signalType, source
        ).run();
      }
    } catch (error) {
      console.error('Error updating signal performance:', error);
    }
  }
}

module.exports = {
  AdvancedSignalDetector,
  ADVANCED_SIGNALS,
  CONFIDENCE_WEIGHTS,
  SOURCE_RELIABILITY
};