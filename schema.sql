-- CryptoIntel Data Gathering System Database Schema
-- Designed for multi-source crypto intelligence collection and analysis
-- Integrates with x402 payment ecosystem for monetization

-- Main signals table - stores all detected signals from various sources
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,                    -- Unique signal identifier
  source TEXT NOT NULL,                   -- Data source (coingecko, coinmarketcap, defillama, cryptopanic)
  type TEXT NOT NULL,                     -- Signal type (sentiment_shift, tvl_anomaly, volume_anomaly, price_alert)
  entity TEXT NOT NULL,                   -- Related entity (token, exchange, protocol)
  data TEXT NOT NULL,                     -- JSON data with signal details
  confidence_score FLOAT DEFAULT 0.0,     -- AI confidence score (0.0-1.0)
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  processed BOOLEAN DEFAULT FALSE,        -- Whether signal has been processed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Market data table - stores current and historical market information
CREATE TABLE IF NOT EXISTS market_data (
  id TEXT PRIMARY KEY,                    -- Unique market data identifier
  symbol TEXT NOT NULL,                   -- Trading symbol (BTC, ETH, etc.)
  price FLOAT,                             -- Current price in USD
  volume_24h FLOAT,                        -- 24-hour trading volume
  market_cap FLOAT,                        -- Market capitalization
  price_change_24h FLOAT,                  -- 24-hour price change percentage
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  source TEXT NOT NULL,                   -- Data source
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Entity mentions table - tracks entity frequency and sentiment
CREATE TABLE IF NOT EXISTS entity_mentions (
  id TEXT PRIMARY KEY,                    -- Unique mention identifier
  signal_id TEXT NOT NULL,                -- Reference to signals table
  entity_type TEXT NOT NULL,              -- Type of entity (token, exchange, wallet, protocol)
  entity_name TEXT NOT NULL,              -- Name of the entity
  mention_count INTEGER DEFAULT 1,       -- Number of mentions
  sentiment_score FLOAT DEFAULT 0.0,      -- Sentiment score (-1.0 to 1.0)
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
);

-- Transactions table - tracks all x402 payments for intelligence
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,                    -- Unique transaction identifier
  tool_id TEXT NOT NULL,                  -- Tool that generated the transaction
  user_wallet TEXT,                       -- User wallet address
  amount FLOAT NOT NULL,                   -- Payment amount
  currency TEXT NOT NULL DEFAULT 'ETH',   -- Payment currency
  status TEXT NOT NULL DEFAULT 'pending', -- Transaction status
  metadata TEXT,                          -- JSON metadata
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User analytics table - tracks user behavior and preferences
CREATE TABLE IF NOT EXISTS user_analytics (
  id TEXT PRIMARY KEY,                    -- Unique analytics record
  user_wallet TEXT,                       -- User wallet address
  tool_id TEXT NOT NULL,                  -- Tool accessed
  action TEXT NOT NULL,                   -- Action performed (view, purchase, download)
  metadata TEXT,                          -- JSON metadata
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Signal patterns table - stores detected patterns for ML training
CREATE TABLE IF NOT EXISTS signal_patterns (
  id TEXT PRIMARY KEY,                    -- Unique pattern identifier
  pattern_type TEXT NOT NULL,             -- Pattern type (correlation, anomaly, trend)
  entities TEXT NOT NULL,                 -- JSON array of involved entities
  pattern_data TEXT NOT NULL,             -- JSON pattern details
  confidence_score FLOAT DEFAULT 0.0,     -- Pattern confidence
  valid_until INTEGER,                    -- Unix timestamp when pattern expires
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking - monitors rate limits and usage patterns
CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,                    -- Unique usage record
  source TEXT NOT NULL,                   -- API source
  endpoint TEXT NOT NULL,                 -- API endpoint called
  request_count INTEGER DEFAULT 1,       -- Number of requests
  response_time INTEGER,                  -- Response time in milliseconds
  status_code INTEGER,                    -- HTTP status code
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content generation queue - stores content to be generated
CREATE TABLE IF NOT EXISTS content_queue (
  id TEXT PRIMARY KEY,                    -- Unique content record
  type TEXT NOT NULL,                     -- Content type (article, video_script, social_post)
  source_data TEXT NOT NULL,              -- JSON source data
  status TEXT DEFAULT 'pending',          -- Generation status
  output_url TEXT,                        -- URL to generated content
  metadata TEXT,                          -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
-- Basic indexes for common queries
CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source, type);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_processed ON signals(processed);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_name, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_timestamp ON entity_mentions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tool_id ON transactions(tool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_wallet ON user_analytics(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_analytics_timestamp ON user_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signal_patterns_type ON signal_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_api_usage_source ON api_usage(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);

-- Advanced performance indexes (added 2025-11-29)
-- Signals table composite indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_signals_entity_timestamp ON signals(entity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_confidence_timestamp ON signals(confidence_score DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type_processed_timestamp ON signals(type, processed, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_entity_confidence ON signals(entity, confidence_score DESC);

-- Market data composite indexes for time-series analysis
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp_desc ON market_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_source_timestamp ON market_data(source, timestamp DESC);

-- Entity mentions composite indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_entity_mentions_timestamp_entity ON entity_mentions(timestamp DESC, entity_name, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_signal_id ON entity_mentions(signal_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_sentiment ON entity_mentions(entity_name, entity_type, sentiment_score);

-- Transaction composite indexes for revenue analytics
CREATE INDEX IF NOT EXISTS idx_transactions_status_tool_currency ON transactions(status, tool_id, currency);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_timestamp ON transactions(user_wallet, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_timestamp ON transactions(status, timestamp DESC);

-- User analytics composite indexes
CREATE INDEX IF NOT EXISTS idx_user_analytics_tool_timestamp ON user_analytics(tool_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_action_wallet ON user_analytics(action, user_wallet);

-- Signal patterns composite indexes
CREATE INDEX IF NOT EXISTS idx_signal_patterns_valid_type ON signal_patterns(valid_until DESC, pattern_type);
CREATE INDEX IF NOT EXISTS idx_signal_patterns_confidence ON signal_patterns(confidence_score DESC, created_at DESC);

-- API usage composite indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_api_usage_source_endpoint_timestamp ON api_usage(source, endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_response_time ON api_usage(response_time DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status_timestamp ON api_usage(status_code, timestamp DESC);

-- Content queue composite indexes
CREATE INDEX IF NOT EXISTS idx_content_queue_status_type ON content_queue(status, type);
CREATE INDEX IF NOT EXISTS idx_content_queue_status_created ON content_queue(status, created_at ASC);

-- Views for common queries
CREATE VIEW IF NOT EXISTS recent_signals AS
SELECT 
  s.*,
  em.entity_name,
  em.entity_type,
  em.sentiment_score as entity_sentiment
FROM signals s
LEFT JOIN entity_mentions em ON s.id = em.signal_id
WHERE s.timestamp > (strftime('%s', 'now') - 86400) -- Last 24 hours
ORDER BY s.confidence_score DESC, s.timestamp DESC;

CREATE VIEW IF NOT EXISTS market_summary AS
SELECT 
  symbol,
  AVG(price) as avg_price,
  MAX(price) as max_price,
  MIN(price) as min_price,
  AVG(volume_24h) as avg_volume,
  AVG(price_change_24h) as avg_change
FROM market_data
WHERE timestamp > (strftime('%s', 'now') - 86400) -- Last 24 hours
GROUP BY symbol
ORDER BY avg_volume DESC;

CREATE VIEW IF NOT EXISTS transaction_summary AS
SELECT 
  tool_id,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue,
  AVG(amount) as avg_transaction_value,
  currency
FROM transactions
WHERE status = 'confirmed'
GROUP BY tool_id, currency
ORDER BY total_revenue DESC;

CREATE VIEW IF NOT EXISTS top_entities AS
SELECT 
  entity_name,
  entity_type,
  COUNT(*) as mention_count,
  AVG(sentiment_score) as avg_sentiment,
  MAX(timestamp) as last_mention
FROM entity_mentions
WHERE timestamp > (strftime('%s', 'now') - 604800) -- Last 7 days
GROUP BY entity_name, entity_type
ORDER BY mention_count DESC, avg_sentiment DESC;

-- Triggers for data consistency
CREATE TRIGGER IF NOT EXISTS update_signals_timestamp
AFTER UPDATE ON signals
BEGIN
  UPDATE signals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp
AFTER UPDATE ON transactions
BEGIN
  UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_content_queue_timestamp
AFTER UPDATE ON content_queue
BEGIN
  UPDATE content_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- DEX-specific tables for CoinMarketCap DEX API integration

-- DEX pairs table - stores decentralized exchange trading pairs
CREATE TABLE IF NOT EXISTS dex_pairs (
    id TEXT PRIMARY KEY,                    -- Unique pair identifier from CMC
    name TEXT NOT NULL,                     -- Pair name (e.g., "BTC/ETH")
    base_currency_id INTEGER,                -- Base currency ID
    quote_currency_id INTEGER,               -- Quote currency ID
    network_id TEXT,                        -- Network/blockchain ID
    dex_id TEXT,                           -- DEX identifier
    price FLOAT,                             -- Current price in USD
    volume_24h FLOAT,                        -- 24-hour trading volume
    liquidity FLOAT,                          -- Total liquidity
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX networks table - stores blockchain network information
CREATE TABLE IF NOT EXISTS dex_networks (
    id TEXT PRIMARY KEY,                    -- Unique network identifier from CMC
    name TEXT NOT NULL,                     -- Network name (e.g., "Ethereum", "BSC")
    chain_id INTEGER,                        -- Chain ID for the network
    native_currency_id INTEGER,              -- Native currency ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX signals table - stores DEX-specific trading signals
CREATE TABLE IF NOT EXISTS dex_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,    -- Unique signal identifier
    signal_type TEXT NOT NULL,              -- Signal type ('dex_volume_anomaly', 'dex_new_pair', 'dex_liquidity_shift')
    dex_id TEXT,                           -- Related DEX identifier
    pair_id TEXT,                           -- Related pair identifier
    network_id TEXT,                        -- Related network identifier
    details TEXT,                            -- Signal details in JSON format
    confidence_score FLOAT,                   -- Confidence score (0.0-1.0)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX trades table - stores recent trade data
CREATE TABLE IF NOT EXISTS dex_trades (
    id TEXT PRIMARY KEY,                    -- Unique trade identifier
    pair_id TEXT NOT NULL,                  -- Related pair identifier
    trade_type TEXT NOT NULL,               -- Trade type ('buy' or 'sell')
    price FLOAT NOT NULL,                    -- Trade price
    quantity FLOAT NOT NULL,                  -- Trade quantity
    amount FLOAT NOT NULL,                   -- Total trade amount (price * quantity)
    timestamp INTEGER NOT NULL,              -- Trade timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX listings table - stores DEX exchange information
CREATE TABLE IF NOT EXISTS dex_listings (
    id TEXT PRIMARY KEY,                    -- Unique DEX identifier
    name TEXT NOT NULL,                     -- DEX name
    description TEXT,                        -- DEX description
    website TEXT,                           -- DEX website URL
    logo_url TEXT,                          -- DEX logo URL
    trust_score FLOAT,                       -- Trust score from CMC
    volume_24h FLOAT,                        -- 24-hour trading volume
    number_of_pairs INTEGER,                 -- Number of trading pairs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for DEX tables performance optimization
-- Basic DEX indexes
CREATE INDEX IF NOT EXISTS idx_dex_pairs_volume ON dex_pairs(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_network ON dex_pairs(network_id);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_dex ON dex_pairs(dex_id);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_last_updated ON dex_pairs(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_dex_networks_name ON dex_networks(name);
CREATE INDEX IF NOT EXISTS idx_dex_networks_chain_id ON dex_networks(chain_id);
CREATE INDEX IF NOT EXISTS idx_dex_signals_created ON dex_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dex_signals_type ON dex_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_dex_signals_pair_id ON dex_signals(pair_id);
CREATE INDEX IF NOT EXISTS idx_dex_trades_pair_id ON dex_trades(pair_id);
CREATE INDEX IF NOT EXISTS idx_dex_trades_timestamp ON dex_trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dex_listings_volume ON dex_listings(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_dex_listings_trust_score ON dex_listings(trust_score DESC);

-- Advanced DEX composite indexes (added 2025-11-29)
-- DEX pairs composite indexes for volume leaders and filtering
CREATE INDEX IF NOT EXISTS idx_dex_pairs_network_volume ON dex_pairs(network_id, volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_liquidity_volume ON dex_pairs(liquidity DESC, volume_24h DESC);

-- DEX signals composite indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_dex_signals_type_pair_created ON dex_signals(signal_type, pair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dex_signals_network_confidence ON dex_signals(network_id, confidence_score DESC);

-- DEX trades composite index for pair-based time-series queries
CREATE INDEX IF NOT EXISTS idx_dex_trades_pair_timestamp_desc ON dex_trades(pair_id, timestamp DESC);

-- Views for DEX data analysis
CREATE VIEW IF NOT EXISTS dex_volume_leaders AS
SELECT
    dp.name,
    dp.volume_24h,
    dp.price,
    dn.name as network_name,
    dl.name as dex_name,
    dp.last_updated
FROM dex_pairs dp
LEFT JOIN dex_networks dn ON dp.network_id = dn.id
LEFT JOIN dex_listings dl ON dp.dex_id = dl.id
WHERE dp.volume_24h > 0
ORDER BY dp.volume_24h DESC
LIMIT 50;

CREATE VIEW IF NOT EXISTS dex_recent_signals AS
SELECT
    ds.signal_type,
    ds.details,
    ds.confidence_score,
    dp.name as pair_name,
    dn.name as network_name,
    ds.created_at
FROM dex_signals ds
LEFT JOIN dex_pairs dp ON ds.pair_id = dp.id
LEFT JOIN dex_networks dn ON ds.network_id = dn.id
ORDER BY ds.created_at DESC
LIMIT 100;

-- Triggers for DEX table consistency
CREATE TRIGGER IF NOT EXISTS update_dex_pairs_timestamp
AFTER UPDATE ON dex_pairs
BEGIN
    UPDATE dex_pairs SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dex_listings_timestamp
AFTER UPDATE ON dex_listings
BEGIN
    UPDATE dex_listings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Sample data for testing (optional)
-- INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed)
-- VALUES
--   ('test_1', 'coingecko', 'price_alert', 'bitcoin', '{"price": 45000, "change": 5.2}', 0.85, strftime('%s', 'now'), FALSE),
--   ('test_2', 'cryptopanic', 'sentiment_shift', 'ethereum', '{"sentiment": "bullish", "keywords": ["adoption", "growth"]}', 0.72, strftime('%s', 'now'), FALSE);

-- INSERT INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source)
-- VALUES
--   ('market_1', 'BTC', 45000.00, 25000000000, 880000000000, 5.2, strftime('%s', 'now'), 'coingecko'),
--   ('market_2', 'ETH', 3200.00, 15000000000, 384000000000, 3.8, strftime('%s', 'now'), 'coingecko');

-- INSERT INTO transactions (id, tool_id, user_wallet, amount, currency, status, metadata, timestamp)
-- VALUES
--   ('tx_1', 'cryptointel-analysis', '0x1234567890abcdef', 0.001, 'ETH', 'confirmed', '{"report_type": "comprehensive"}', strftime('%s', 'now'));