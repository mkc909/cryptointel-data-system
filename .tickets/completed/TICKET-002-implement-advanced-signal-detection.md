# TICKET-002: Implement Advanced Signal Detection

## Status
- [ ] In Progress
- [ ] Code Complete
- [ ] Tested
- [ ] Reviewed
- [ ] Merged

## Type
Feature

## Priority
- [ ] Critical (P0)
- [x] High (P1)
- [ ] Medium (P2)
- [ ] Low (P3)

## Description
Enhance signal detection capabilities with ML-based pattern recognition, historical analysis, and multi-source correlation to identify high-value trading opportunities.

## Acceptance Criteria
- [ ] ML pattern recognition system implemented
- [ ] Historical signal analysis with backtesting
- [ ] Multi-source signal correlation
- [ ] Confidence scoring enhanced (0.0-1.0 scale)
- [ ] Real-time signal prioritization
- [ ] Signal pattern storage in D1
- [ ] Performance metrics dashboard
- [ ] Alert system for high-confidence signals

## Technical Details

### Implementation Plan

1. **Phase 1: Enhanced Signal Types**
   - Implement compound signal detection
   - Cross-source signal validation
   - Temporal pattern analysis
   - Entity relationship mapping

2. **Phase 2: ML Pattern Recognition**
   - Implement pattern storage in `signal_patterns` table
   - Create training data pipeline
   - Add pattern matching algorithms
   - Confidence score calculation enhancement

3. **Phase 3: Historical Analysis**
   - 30-day rolling window analysis
   - Pattern success rate tracking
   - Signal accuracy metrics
   - Backtesting framework

4. **Phase 4: Real-time Processing**
   - Stream processing for incoming data
   - Priority queue for signal processing
   - Alert thresholds configuration
   - WebSocket preparation (for TICKET-003)

### New Signal Types to Implement
```javascript
const ADVANCED_SIGNALS = {
  // Compound Signals
  'whale_accumulation': {
    sources: ['coingecko', 'defi_llama', 'dex'],
    confidence_weight: 0.9
  },
  'breakout_pattern': {
    sources: ['market_data', 'volume_analysis'],
    confidence_weight: 0.85
  },
  'social_momentum': {
    sources: ['cryptopanic', 'entity_mentions'],
    confidence_weight: 0.7
  },
  'liquidity_cascade': {
    sources: ['dex', 'defi_llama'],
    confidence_weight: 0.8
  },
  'risk_reversal': {
    sources: ['sentiment', 'price_action'],
    confidence_weight: 0.75
  }
};
```

### Files to Modify
- [ ] `src/index.js` - Add advanced signal detection logic
- [ ] `src/signals.js` - New file for signal processing
- [ ] `src/ml-patterns.js` - New file for ML pattern recognition
- [ ] `schema.sql` - Enhance signal_patterns table
- [ ] `test/signals.test.js` - New test suite for signals
- [ ] `src/dashboard.js` - Add signal analytics
- [ ] `docs/signal-detection.md` - New documentation

### Database Schema Enhancements
```sql
-- Enhanced signal_patterns table
ALTER TABLE signal_patterns ADD COLUMN
    pattern_type TEXT NOT NULL DEFAULT 'simple',
    success_rate REAL DEFAULT 0.0,
    backtest_results TEXT,
    last_matched DATETIME,
    match_count INTEGER DEFAULT 0;

-- New signal_correlations table
CREATE TABLE signal_correlations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id_1 INTEGER,
    signal_id_2 INTEGER,
    correlation_score REAL,
    time_offset INTEGER, -- seconds between signals
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id_1) REFERENCES signals(id),
    FOREIGN KEY (signal_id_2) REFERENCES signals(id)
);

-- New signal_performance table
CREATE TABLE signal_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_type TEXT NOT NULL,
    accuracy_rate REAL,
    avg_confidence REAL,
    total_count INTEGER,
    true_positives INTEGER,
    false_positives INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster pattern matching
CREATE INDEX idx_patterns_type_score ON signal_patterns(pattern_type, success_rate DESC);
```

### Algorithm Components

1. **Pattern Recognition Engine**
   - Sliding window analysis (1h, 4h, 24h)
   - Feature extraction from price/volume data
   - Pattern similarity scoring
   - Historical pattern matching

2. **Confidence Scoring Formula**
   ```javascript
   confidence = (
     source_reliability * 0.3 +
     pattern_match_score * 0.3 +
     historical_accuracy * 0.2 +
     entity_reputation * 0.1 +
     time_relevance * 0.1
   );
   ```

3. **Multi-Source Correlation**
   - Temporal alignment of signals
   - Cross-validation between sources
   - Weighted consensus mechanism
   - Conflict resolution strategy

## Testing Plan
- [ ] Unit tests for each signal type
- [ ] Pattern recognition accuracy tests
- [ ] Backtesting with historical data
- [ ] Performance tests (< 100ms per signal)
- [ ] Stress tests with high volume
- [ ] Integration tests with all data sources
- [ ] A/B testing for confidence thresholds

## Worktree Setup
```bash
git worktree add .tickets/worktrees/TICKET-002 -b feature/TICKET-002-advanced-signals
cd .tickets/worktrees/TICKET-002
npm install
npm run dev
```

## Related Issues/PRs
- GitHub Issue: #TBD
- Depends on: TICKET-001 (DEX data for correlation)
- Blocks: Content generation features
- Related to: ML training pipeline

## Performance Requirements
- Signal detection: < 100ms per incoming data point
- Pattern matching: < 500ms for historical analysis
- Confidence calculation: < 50ms
- Database queries: < 200ms for complex correlations
- Memory usage: < 512MB for pattern cache

## Success Metrics
- Signal accuracy > 70%
- False positive rate < 15%
- High-confidence signals (>0.8) accuracy > 85%
- Processing latency < 1 second end-to-end
- Pattern library growth > 100 patterns/week

## Notes
- Consider using Cloudflare Workers AI for ML inference
- Implement gradual rollout with feature flags
- Monitor resource usage closely
- Prepare for real-time WebSocket integration
- Consider edge caching for frequently accessed patterns

## Completion Checklist
- [ ] All signal types implemented
- [ ] ML pattern recognition working
- [ ] Historical analysis complete
- [ ] Tests written and passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Branch merged
- [ ] Worktree removed
- [ ] Ticket archived

## Time Tracking
- Estimated: 24 hours
- Actual: TBD
- Started: 2025-11-27
- Completed: YYYY-MM-DD

## Implementation Progress
### Core Components
- [ ] Signal processor class
- [ ] Pattern recognition engine
- [ ] Confidence calculator
- [ ] Historical analyzer
- [ ] Multi-source correlator
- [ ] Alert system
- [ ] Performance monitor

### Signal Types Completed
- [ ] whale_accumulation
- [ ] breakout_pattern
- [ ] social_momentum
- [ ] liquidity_cascade
- [ ] risk_reversal