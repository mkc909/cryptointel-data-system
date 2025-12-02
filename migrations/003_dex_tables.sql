-- Migration 003: Add DEX API tables
-- Created: 2025-12-01
-- Purpose: Support CoinMarketCap DEX API v4 integration

-- DEX pairs table - stores trading pair information from DEX APIs
CREATE TABLE IF NOT EXISTS dex_pairs (
  id TEXT PRIMARY KEY,                    -- Unique pair identifier
  pair_id TEXT NOT NULL,                   -- CoinMarketCap pair ID
  name TEXT NOT NULL,                       -- Pair name (e.g., "BTC/ETH")
  base_currency_id INTEGER,                   -- Base currency ID
  quote_currency_id INTEGER,                  -- Quote currency ID
  network_id TEXT,                           -- Network/blockchain ID
  dex_id TEXT,                              -- DEX identifier
  price REAL,                                -- Current price
  volume_24h REAL,                          -- 24-hour trading volume
  liquidity REAL,                            -- Total liquidity
  price_change_24h REAL,                     -- 24-hour price change
  last_updated DATETIME,                      -- Last update timestamp from API
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX networks table - stores blockchain network information
CREATE TABLE IF NOT EXISTS dex_networks (
  id TEXT PRIMARY KEY,                       -- Unique network identifier
  network_id INTEGER NOT NULL,               -- CoinMarketCap network ID
  name TEXT NOT NULL,                        -- Network name (e.g., "Ethereum")
  symbol TEXT,                               -- Network symbol (e.g., "ETH")
  chain_id INTEGER,                          -- Blockchain chain ID
  native_currency_id INTEGER,                  -- Native currency ID
  is_active BOOLEAN DEFAULT TRUE,             -- Whether network is active
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX signals table - stores DEX-specific signals and patterns
CREATE TABLE IF NOT EXISTS dex_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,        -- Unique signal identifier
  signal_type TEXT NOT NULL,                  -- Signal type (volume_anomaly, new_pair, etc.)
  dex_id TEXT,                              -- DEX identifier
  pair_id TEXT,                              -- Trading pair ID
  network_id TEXT,                           -- Network identifier
  details TEXT,                              -- JSON details about the signal
  confidence_score REAL DEFAULT 0.0,          -- Signal confidence (0.0-1.0)
  is_valid BOOLEAN DEFAULT TRUE,               -- Whether signal is still valid
  valid_until INTEGER,                         -- Unix timestamp when signal expires
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX listings table - stores DEX exchange information
CREATE TABLE IF NOT EXISTS dex_listings (
  id TEXT PRIMARY KEY,                        -- Unique listing identifier
  dex_id TEXT NOT NULL,                      -- CoinMarketCap DEX ID
  name TEXT NOT NULL,                         -- DEX name
  website TEXT,                               -- DEX website URL
  description TEXT,                           -- DEX description
  volume_24h REAL,                          -- 24-hour trading volume
  market_share REAL,                          -- Market share percentage
  number_of_pairs INTEGER,                     -- Total number of trading pairs
  is_active BOOLEAN DEFAULT TRUE,              -- Whether DEX is active
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEX OHLCV data table - stores historical price data
CREATE TABLE IF NOT EXISTS dex_ohlcv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,        -- Unique OHLCV record
  pair_id TEXT NOT NULL,                      -- Trading pair ID
  timestamp INTEGER NOT NULL,                  -- Unix timestamp (period start)
  open_price REAL NOT NULL,                    -- Opening price
  high_price REAL NOT NULL,                    -- Highest price
  low_price REAL NOT NULL,                     -- Lowest price
  close_price REAL NOT NULL,                   -- Closing price
  volume REAL NOT NULL,                       -- Trading volume
  period TEXT NOT NULL DEFAULT '1h',          -- Time period (1h, 4h, 1d, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for DEX tables
CREATE INDEX IF NOT EXISTS idx_dex_pairs_pair_id ON dex_pairs(pair_id);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_network ON dex_pairs(network_id);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_dex ON dex_pairs(dex_id);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_volume ON dex_pairs(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_dex_pairs_updated ON dex_pairs(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_dex_networks_network_id ON dex_networks(network_id);
CREATE INDEX IF NOT EXISTS idx_dex_networks_chain_id ON dex_networks(chain_id);
CREATE INDEX IF NOT EXISTS idx_dex_networks_active ON dex_networks(is_active);

CREATE INDEX IF NOT EXISTS idx_dex_signals_type ON dex_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_dex_signals_pair ON dex_signals(pair_id);
CREATE INDEX IF NOT EXISTS idx_dex_signals_network ON dex_signals(network_id);
CREATE INDEX IF NOT EXISTS idx_dex_signals_confidence ON dex_signals(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_dex_signals_valid_until ON dex_signals(valid_until DESC);
CREATE INDEX IF NOT EXISTS idx_dex_signals_created ON dex_signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dex_listings_dex_id ON dex_listings(dex_id);
CREATE INDEX IF NOT EXISTS idx_dex_listings_volume ON dex_listings(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_dex_listings_active ON dex_listings(is_active);

CREATE INDEX IF NOT EXISTS idx_dex_ohlcv_pair_timestamp ON dex_ohlcv(pair_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dex_ohlcv_timestamp ON dex_ohlcv(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dex_ohlcv_period ON dex_ohlcv(period);

-- Views for DEX analytics
CREATE VIEW IF NOT EXISTS dex_top_pairs AS
SELECT 
  dp.*,
  dn.name as network_name,
  dl.name as dex_name
FROM dex_pairs dp
LEFT JOIN dex_networks dn ON dp.network_id = dn.id
LEFT JOIN dex_listings dl ON dp.dex_id = dl.dex_id
WHERE dp.volume_24h > 0
ORDER BY dp.volume_24h DESC
LIMIT 100;

CREATE VIEW IF NOT EXISTS dex_recent_signals AS
SELECT 
  ds.*,
  dp.name as pair_name,
  dn.name as network_name,
  dl.name as dex_name
FROM dex_signals ds
LEFT JOIN dex_pairs dp ON ds.pair_id = dp.pair_id
LEFT JOIN dex_networks dn ON ds.network_id = dn.id
LEFT JOIN dex_listings dl ON ds.dex_id = dl.dex_id
WHERE ds.is_valid = TRUE 
  AND (ds.valid_until IS NULL OR ds.valid_until > strftime('%s', 'now'))
ORDER BY ds.confidence_score DESC, ds.created_at DESC;

CREATE VIEW IF NOT EXISTS dex_network_summary AS
SELECT 
  dn.*,
  COUNT(dp.id) as pair_count,
  SUM(dp.volume_24h) as total_volume,
  AVG(dp.volume_24h) as avg_pair_volume
FROM dex_networks dn
LEFT JOIN dex_pairs dp ON dn.id = dp.network_id
WHERE dn.is_active = TRUE
GROUP BY dn.id
ORDER BY total_volume DESC;