-- Migration 004: Enhanced Signal Tables for Advanced Signal Detection
-- Adds tables for compound signals, correlations, performance tracking, and ML patterns

-- Enhanced signal_patterns table with additional fields for ML
ALTER TABLE signal_patterns ADD COLUMN pattern_type TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE signal_patterns ADD COLUMN success_rate REAL DEFAULT 0.0;
ALTER TABLE signal_patterns ADD COLUMN backtest_results TEXT;
ALTER TABLE signal_patterns ADD COLUMN last_matched DATETIME;
ALTER TABLE signal_patterns ADD COLUMN match_count INTEGER DEFAULT 0;

-- New signal_correlations table for cross-source signal validation
CREATE TABLE IF NOT EXISTS signal_correlations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id_1 TEXT NOT NULL,
    signal_id_2 TEXT NOT NULL,
    correlation_score REAL NOT NULL,
    time_offset INTEGER, -- seconds between signals
    correlation_type TEXT NOT NULL, -- 'temporal', 'entity', 'source'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signal_id_1) REFERENCES signals(id) ON DELETE CASCADE,
    FOREIGN KEY (signal_id_2) REFERENCES signals(id) ON DELETE CASCADE
);

-- New signal_performance table for tracking accuracy metrics
CREATE TABLE IF NOT EXISTS signal_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_type TEXT NOT NULL,
    source TEXT NOT NULL,
    accuracy_rate REAL DEFAULT 0.0,
    avg_confidence REAL DEFAULT 0.0,
    total_count INTEGER DEFAULT 0,
    true_positives INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    false_negatives INTEGER DEFAULT 0,
    precision_score REAL DEFAULT 0.0,
    recall_score REAL DEFAULT 0.0,
    f1_score REAL DEFAULT 0.0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(signal_type, source)
);

-- New compound_signals table for multi-source signal combinations
CREATE TABLE IF NOT EXISTS compound_signals (
    id TEXT PRIMARY KEY,
    component_signals TEXT NOT NULL, -- JSON array of component signal IDs
    signal_type TEXT NOT NULL, -- 'whale_accumulation', 'breakout_pattern', etc.
    entities TEXT NOT NULL, -- JSON array of involved entities
    confidence_score REAL NOT NULL,
    validation_score REAL DEFAULT 0.0, -- Cross-source validation score
    metadata TEXT, -- Additional signal metadata
    timestamp INTEGER NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New entity_relationships table for mapping entity connections
CREATE TABLE IF NOT EXISTS entity_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_1 TEXT NOT NULL,
    entity_2 TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- 'correlation', 'dependency', 'competition'
    strength REAL NOT NULL, -- 0.0 to 1.0
    source TEXT NOT NULL, -- How this relationship was discovered
    metadata TEXT, -- Additional relationship data
    valid_until INTEGER, -- Unix timestamp when relationship expires
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_1, entity_2, relationship_type, source)
);

-- New temporal_patterns table for time-based pattern analysis
CREATE TABLE IF NOT EXISTS temporal_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'seasonal', 'cyclical', 'trend'
    entities TEXT NOT NULL, -- JSON array of entities involved
    time_window INTEGER NOT NULL, -- Time window in seconds
    pattern_data TEXT NOT NULL, -- JSON pattern definition
    confidence_score REAL DEFAULT 0.0,
    success_rate REAL DEFAULT 0.0,
    last_detected INTEGER, -- Unix timestamp of last detection
    detection_count INTEGER DEFAULT 0,
    valid_until INTEGER, -- Unix timestamp when pattern expires
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New signal_validation_queue table for pending validations
CREATE TABLE IF NOT EXISTS signal_validation_queue (
    id TEXT PRIMARY KEY,
    signal_id TEXT NOT NULL,
    validation_type TEXT NOT NULL, -- 'cross_source', 'historical', 'entity_correlation'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    priority INTEGER DEFAULT 0, -- Higher numbers = higher priority
    metadata TEXT, -- Validation parameters
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
);

-- Indexes for enhanced signal tables
-- Signal correlations indexes
CREATE INDEX IF NOT EXISTS idx_signal_correlations_score ON signal_correlations(correlation_score DESC);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_type ON signal_correlations(correlation_type, correlation_score DESC);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_time_offset ON signal_correlations(time_offset);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_created ON signal_correlations(created_at DESC);

-- Signal performance indexes
CREATE INDEX IF NOT EXISTS idx_signal_performance_type ON signal_performance(signal_type, source);
CREATE INDEX IF NOT EXISTS idx_signal_performance_accuracy ON signal_performance(accuracy_rate DESC);
CREATE INDEX IF NOT EXISTS idx_signal_performance_f1 ON signal_performance(f1_score DESC);

-- Compound signals indexes
CREATE INDEX IF NOT EXISTS idx_compound_signals_type ON compound_signals(signal_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_compound_signals_confidence ON compound_signals(confidence_score DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_compound_signals_processed ON compound_signals(processed, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_compound_signals_timestamp ON compound_signals(timestamp DESC);

-- Entity relationships indexes
CREATE INDEX IF NOT EXISTS idx_entity_relationships_entities ON entity_relationships(entity_1, entity_2);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON entity_relationships(relationship_type, strength DESC);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_strength ON entity_relationships(strength DESC);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_valid ON entity_relationships(valid_until DESC);

-- Temporal patterns indexes
CREATE INDEX IF NOT EXISTS idx_temporal_patterns_type ON temporal_patterns(pattern_type, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_patterns_confidence ON temporal_patterns(confidence_score DESC, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_patterns_detected ON temporal_patterns(last_detected DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_patterns_valid ON temporal_patterns(valid_until DESC);

-- Signal validation queue indexes
CREATE INDEX IF NOT EXISTS idx_signal_validation_status ON signal_validation_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_signal_validation_type ON signal_validation_queue(validation_type, status);
CREATE INDEX IF NOT EXISTS idx_signal_validation_created ON signal_validation_queue(created_at ASC);

-- Enhanced signal_patterns indexes (for new columns)
CREATE INDEX IF NOT EXISTS idx_signal_patterns_type_score ON signal_patterns(pattern_type, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_signal_patterns_matched ON signal_patterns(last_matched DESC);
CREATE INDEX IF NOT EXISTS idx_signal_patterns_count ON signal_patterns(match_count DESC);

-- Views for enhanced signal analysis
CREATE VIEW IF NOT EXISTS compound_signal_summary AS
SELECT 
    cs.signal_type,
    COUNT(*) as total_signals,
    AVG(cs.confidence_score) as avg_confidence,
    AVG(cs.validation_score) as avg_validation,
    COUNT(CASE WHEN cs.processed = TRUE THEN 1 END) as processed_count,
    cs.timestamp as latest_signal
FROM compound_signals cs
WHERE cs.timestamp > (strftime('%s', 'now') - 86400) -- Last 24 hours
GROUP BY cs.signal_type
ORDER BY total_signals DESC;

CREATE VIEW IF NOT EXISTS signal_correlation_summary AS
SELECT 
    sc.correlation_type,
    COUNT(*) as total_correlations,
    AVG(sc.correlation_score) as avg_correlation,
    MAX(sc.correlation_score) as max_correlation,
    sc.created_at as latest_correlation
FROM signal_correlations sc
WHERE sc.created_at > (strftime('%s', 'now') - 86400) -- Last 24 hours
GROUP BY sc.correlation_type
ORDER BY avg_correlation DESC;

CREATE VIEW IF NOT EXISTS entity_relationship_strength AS
SELECT 
    er.entity_1,
    er.entity_2,
    er.relationship_type,
    er.strength,
    er.source,
    er.valid_until,
    er.created_at
FROM entity_relationships er
WHERE er.valid_until > strftime('%s', 'now') OR er.valid_until IS NULL
ORDER BY er.strength DESC;

CREATE VIEW IF NOT EXISTS signal_performance_leaderboard AS
SELECT 
    sp.signal_type,
    sp.source,
    sp.accuracy_rate,
    sp.precision_score,
    sp.recall_score,
    sp.f1_score,
    sp.total_count,
    sp.updated_at,
    RANK() OVER (PARTITION BY sp.signal_type ORDER BY sp.f1_score DESC) as rank_in_type,
    RANK() OVER (ORDER BY sp.f1_score DESC) as overall_rank
FROM signal_performance sp
WHERE sp.total_count >= 10 -- Minimum sample size
ORDER BY sp.f1_score DESC;

-- Triggers for data consistency
CREATE TRIGGER IF NOT EXISTS update_signal_performance_timestamp
AFTER UPDATE ON signal_performance
BEGIN
    UPDATE signal_performance SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_compound_signals_timestamp
AFTER UPDATE ON compound_signals
BEGIN
    UPDATE compound_signals SET created_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default signal performance records for known signal types
INSERT OR IGNORE INTO signal_performance (signal_type, source) VALUES
('volume_anomaly', 'coingecko'),
('volume_anomaly', 'coinmarketcap'),
('volume_anomaly', 'binance'),
('price_alert', 'coingecko'),
('price_alert', 'coinmarketcap'),
('price_alert', 'binance'),
('sentiment_shift', 'cryptopanic'),
('tvl_anomaly', 'defillama'),
('dex_volume_anomaly', 'coinmarketcap'),
('dex_price_spike', 'coinmarketcap'),
('dex_new_pair', 'coinmarketcap'),
('whale_accumulation', 'system'),
('breakout_pattern', 'system'),
('social_momentum', 'system'),
('liquidity_cascade', 'system'),
('risk_reversal', 'system');

-- Insert default temporal patterns
INSERT OR IGNORE INTO temporal_patterns (pattern_name, pattern_type, entities, time_window, pattern_data, confidence_score) VALUES
('weekend_volume_spike', 'seasonal', '["bitcoin", "ethereum"]', 86400, '{"expected_increase": 0.3, "days": ["saturday", "sunday"]}', 0.6),
('monthly_tvl_growth', 'cyclical', '["defi_protocols"]', 2592000, '{"expected_growth": 0.1, "cycle_day": 1}', 0.7),
('fear_greed_reversal', 'trend', '["market_sentiment"]', 43200, '{"reversal_threshold": 0.8, "duration": 21600}', 0.8);

-- Migration completion marker
INSERT OR IGNORE INTO migration_log (migration_id, applied_at) VALUES 
('004_enhanced_signal_tables', CURRENT_TIMESTAMP);