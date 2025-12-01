# Database Schema Documentation

## Overview

The CryptoIntel Data System uses Cloudflare D1 as its primary database, featuring a comprehensive schema designed for high-performance cryptocurrency intelligence gathering and analysis.

## Database Architecture

### Database Configuration
- **Database Name:** CRYPTOINTEL_DB
- **Engine:** Cloudflare D1 (SQLite-compatible)
- **Location:** Global edge distribution
- **Backup Strategy:** Automated daily backups with point-in-time recovery

### Performance Features
- **29+ Strategic Indexes** for query optimization
- **Composite Indexes** for complex queries
- **Partial Indexes** for frequently accessed data
- **Archival Strategy** for historical data management

---

## Core Tables

### 1. Market Data Tables

#### `market_data`
Stores real-time and historical market data from various sources.

```sql
CREATE TABLE market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  volume_24h REAL,
  market_cap REAL,
  price_change_24h REAL,
  price_change_percentage_24h REAL,
  circulating_supply REAL,
  total_supply REAL,
  max_supply REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC);
CREATE INDEX idx_market_data_source_timestamp ON market_data(source, timestamp DESC);
CREATE INDEX idx_market_data_price_volume ON market_data(price, volume_24h);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp DESC);
```

**Fields Description:**
- `id`: Unique identifier for each record
- `symbol`: Cryptocurrency symbol (e.g., 'BTC', 'ETH')
- `price`: Current price in USD
- `volume_24h`: 24-hour trading volume
- `market_cap`: Market capitalization
- `price_change_24h`: Price change over 24 hours
- `price_change_percentage_24h`: Percentage change over 24 hours
- `circulating_supply`: Circulating supply
- `total_supply`: Total supply
- `max_supply`: Maximum supply (if applicable)
- `timestamp`: Data timestamp
- `source`: Data source (coingecko, coinmarketcap, etc.)
- `created_at`: Record creation timestamp

---

#### `historical_prices`
Stores historical price data for trend analysis.

```sql
CREATE TABLE historical_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  timestamp DATETIME NOT NULL,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for historical queries
CREATE INDEX idx_historical_prices_symbol_timestamp ON historical_prices(symbol, timestamp DESC);
CREATE INDEX idx_historical_prices_timestamp ON historical_prices(timestamp DESC);
CREATE UNIQUE INDEX idx_historical_prices_unique ON historical_prices(symbol, timestamp, source);
```

---

### 2. Signal Detection Tables

#### `signals`
Stores detected intelligence signals with confidence scores.

```sql
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  metadata TEXT,
  description TEXT,
  trigger_value REAL,
  threshold_value REAL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- Indexes for signal queries
CREATE INDEX idx_signals_type_symbol ON signals(type, symbol);
CREATE INDEX idx_signals_confidence ON signals(confidence_score DESC);
CREATE INDEX idx_signals_active_created ON signals(is_active, created_at DESC);
CREATE INDEX idx_signals_symbol_created ON signals(symbol, created_at DESC);
```

**Signal Types:**
- `price_alert`: Significant price movements
- `volume_spike`: Unusual trading volume
- `sentiment_shift`: Major sentiment changes
- `tvl_anomaly`: DeFi TVL anomalies
- `news_mention`: Increased news mentions

**Fields Description:**
- `type`: Type of signal detected
- `symbol`: Related cryptocurrency symbol
- `confidence_score`: AI-generated confidence score (0-1)
- `metadata`: JSON metadata with additional details
- `description`: Human-readable signal description
- `trigger_value`: Value that triggered the signal
- `threshold_value`: Threshold that was exceeded
- `is_active`: Whether the signal is still active
- `expires_at`: Signal expiration time

---

#### `signal_history`
Archived signals for historical analysis.

```sql
CREATE TABLE signal_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  metadata TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME,
  resolution_outcome TEXT
);

-- Indexes for historical analysis
CREATE INDEX idx_signal_history_symbol_created ON signal_history(symbol, created_at DESC);
CREATE INDEX idx_signal_history_type_created ON signal_history(type, created_at DESC);
```

---

### 3. Entity Extraction Tables

#### `entity_mentions`
Tracks mentions of entities across news and social media.

```sql
CREATE TABLE entity_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  source TEXT NOT NULL,
  mention_count INTEGER DEFAULT 1,
  sentiment_score REAL,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for entity queries
CREATE INDEX idx_entity_mentions_type_name ON entity_mentions(entity_type, entity_name);
CREATE INDEX idx_entity_mentions_source_count ON entity_mentions(source, mention_count DESC);
CREATE INDEX idx_entity_mentions_last_seen ON entity_mentions(last_seen DESC);
CREATE INDEX idx_entity_mentions_sentiment ON entity_mentions(sentiment_score DESC);
```

**Entity Types:**
- `cryptocurrency`: Cryptocurrency tokens and coins
- `exchange`: Trading exchanges
- `wallet`: Cryptocurrency wallets
- `person`: Influential people in crypto
- `protocol`: DeFi protocols
- `company`: Crypto companies

---

#### `entity_relationships`
Stores relationships between entities.

```sql
CREATE TABLE entity_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_entity_type TEXT NOT NULL,
  source_entity_name TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_name TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for relationship queries
CREATE INDEX idx_entity_relationships_source ON entity_relationships(source_entity_type, source_entity_name);
CREATE INDEX idx_entity_relationships_target ON entity_relationships(target_entity_type, target_entity_name);
CREATE INDEX idx_entity_relationships_type ON entity_relationships(relationship_type);
```

---

### 4. User Analytics Tables (Priority 2)

#### `user_analytics`
Tracks user behavior and revenue generation.

```sql
CREATE TABLE user_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_method TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER,
  revenue_generated REAL DEFAULT 0,
  request_size INTEGER,
  response_size INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics queries
CREATE INDEX idx_user_analytics_user_id_timestamp ON user_analytics(user_id, timestamp DESC);
CREATE INDEX idx_user_analytics_endpoint_timestamp ON user_analytics(endpoint, timestamp DESC);
CREATE INDEX idx_user_analytics_revenue_timestamp ON user_analytics(revenue_generated DESC, timestamp DESC);
CREATE INDEX idx_user_analytics_status_timestamp ON user_analytics(response_status, timestamp DESC);
```

---

#### `revenue_tracking`
Detailed revenue tracking for x402 payment integration.

```sql
CREATE TABLE revenue_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  revenue_amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  transaction_id TEXT,
  payment_method TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for revenue queries
CREATE INDEX idx_revenue_tracking_user_timestamp ON revenue_tracking(user_id, timestamp DESC);
CREATE INDEX idx_revenue_tracking_amount_timestamp ON revenue_tracking(revenue_amount DESC, timestamp DESC);
CREATE INDEX idx_revenue_tracking_endpoint_timestamp ON revenue_tracking(endpoint, timestamp DESC);
```

---

### 5. System Management Tables

#### `data_sources`
Configuration and status of data sources.

```sql
CREATE TABLE data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT FALSE,
  rate_limit_per_minute INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  last_successful_fetch DATETIME,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for data source management
CREATE INDEX idx_data_sources_active ON data_sources(is_active);
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_last_fetch ON data_sources(last_successful_fetch DESC);
```

---

#### `system_logs`
System operation logs for monitoring and debugging.

```sql
CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for log queries
CREATE INDEX idx_system_logs_level_timestamp ON system_logs(level, timestamp DESC);
CREATE INDEX idx_system_logs_service_timestamp ON system_logs(service, timestamp DESC);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
```

---

## Performance Optimization

### Strategic Indexes

The database includes 29+ strategic indexes optimized for common query patterns:

#### Market Data Indexes
```sql
-- Composite indexes for complex queries
CREATE INDEX idx_market_data_symbol_price_volume ON market_data(symbol, price DESC, volume_24h DESC);
CREATE INDEX idx_market_data_source_symbol ON market_data(source, symbol, timestamp DESC);

-- Partial indexes for active data
CREATE INDEX idx_market_data_recent ON market_data(timestamp DESC) WHERE timestamp > datetime('now', '-24 hours');
```

#### Signal Detection Indexes
```sql
-- Performance indexes for signal queries
CREATE INDEX idx_signals_active_high_confidence ON signals(is_active, confidence_score DESC) WHERE is_active = TRUE;
CREATE INDEX idx_signals_type_symbol_confidence ON signals(type, symbol, confidence_score DESC);
```

#### Analytics Indexes
```sql
-- Optimized indexes for analytics queries
CREATE INDEX idx_user_analytics_daily_revenue ON user_analytics(timestamp DESC, revenue_generated DESC) 
WHERE timestamp > datetime('now', '-30 days');
```

### Query Optimization

#### Common Query Patterns

1. **Latest Market Data**
```sql
-- Optimized query for latest market data
SELECT symbol, price, volume_24h, market_cap, timestamp
FROM market_data 
WHERE symbol = ? AND timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC 
LIMIT 1;
```

2. **Active Signals**
```sql
-- Optimized query for active signals
SELECT type, symbol, confidence_score, description, created_at
FROM signals 
WHERE is_active = TRUE AND confidence_score > 0.7
ORDER BY confidence_score DESC, created_at DESC;
```

3. **User Analytics**
```sql
-- Optimized query for user analytics
SELECT user_id, COUNT(*) as request_count, SUM(revenue_generated) as total_revenue
FROM user_analytics 
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY user_id
ORDER BY total_revenue DESC;
```

---

## Data Archival Strategy

### Archival Tables

#### `archived_market_data`
Historical market data older than 90 days.

```sql
CREATE TABLE archived_market_data (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  volume_24h REAL,
  market_cap REAL,
  timestamp DATETIME NOT NULL,
  source TEXT NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for archived data
CREATE INDEX idx_archived_market_data_symbol_timestamp ON archived_market_data(symbol, timestamp DESC);
```

#### `archived_signals`
Historical signals older than 30 days.

```sql
CREATE TABLE archived_signals (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  metadata TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for archived signals
CREATE INDEX idx_archived_signals_type_created ON archived_signals(type, created_at DESC);
```

### Automated Archival Process

```sql
-- Archive market data older than 90 days
INSERT INTO archived_market_data 
SELECT id, symbol, price, volume_24h, market_cap, timestamp, source, CURRENT_TIMESTAMP
FROM market_data 
WHERE timestamp < datetime('now', '-90 days');

DELETE FROM market_data 
WHERE timestamp < datetime('now', '-90 days');

-- Archive signals older than 30 days
INSERT INTO archived_signals 
SELECT id, type, symbol, confidence_score, metadata, created_at, resolved_at, CURRENT_TIMESTAMP
FROM signals 
WHERE created_at < datetime('now', '-30 days');

DELETE FROM signals 
WHERE created_at < datetime('now', '-30 days');
```

---

## Data Integrity

### Constraints and Validation

#### Foreign Key Relationships
```sql
-- Signal history references
ALTER TABLE signal_history 
ADD CONSTRAINT fk_signal_history_signal_id 
FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE;
```

#### Data Validation
```sql
-- Check constraints for data integrity
ALTER TABLE market_data 
ADD CONSTRAINT chk_market_data_price_positive CHECK (price >= 0);

ALTER TABLE signals 
ADD CONSTRAINT chk_signals_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1);

ALTER TABLE user_analytics 
ADD CONSTRAINT chk_user_analytics_status CHECK (response_status >= 100 AND response_status < 600);
```

### Triggers for Data Consistency

#### Update Timestamps
```sql
-- Trigger to update updated_at timestamp
CREATE TRIGGER update_data_sources_timestamp 
AFTER UPDATE ON data_sources
BEGIN
  UPDATE data_sources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

#### Signal Expiration
```sql
-- Trigger to expire old signals
CREATE TRIGGER expire_old_signals
AFTER INSERT ON signals
BEGIN
  UPDATE signals SET is_active = FALSE 
  WHERE created_at < datetime('now', '-24 hours') AND is_active = TRUE;
END;
```

---

## Migration Strategy

### Version Control

#### Migration Files
- `migrations/001_initial_schema.sql` - Initial database schema
- `migrations/002_performance_indexes.sql` - Performance optimization indexes
- `migrations/003_user_analytics.sql` - Priority 2 user analytics tables
- `migrations/004_archival_strategy.sql` - Data archival implementation

### Rollback Procedures

#### Schema Rollback
```sql
-- Example rollback procedure
BEGIN TRANSACTION;

-- Drop new tables
DROP TABLE IF EXISTS user_analytics;
DROP TABLE IF EXISTS revenue_tracking;

-- Restore previous schema
-- ... rollback statements ...

COMMIT;
```

---

## Monitoring and Maintenance

### Performance Monitoring

#### Query Performance
```sql
-- Monitor slow queries
EXPLAIN QUERY PLAN 
SELECT symbol, AVG(price) as avg_price 
FROM market_data 
WHERE timestamp > datetime('now', '-24 hours') 
GROUP BY symbol;
```

#### Index Usage
```sql
-- Check index usage
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type = 'index' AND tbl_name = 'market_data';
```

### Maintenance Tasks

#### Database Optimization
```sql
-- Vacuum and analyze for performance optimization
VACUUM;
ANALYZE;
```

#### Index Rebuilding
```sql
-- Rebuild indexes for optimal performance
REINDEX;

-- Rebuild specific index
REINDEX idx_market_data_symbol_timestamp;
```

---

**Last Updated:** 2025-11-30  
**Schema Version:** v2.0.0  
**Next Review:** Post-Priority 3 completion