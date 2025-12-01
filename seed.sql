-- CryptoIntel Data System Seed Data
-- Sample data for testing and development

-- Insert sample signals
INSERT INTO signals (id, source, type, entity, data, confidence_score, timestamp, processed) VALUES
('signal_001', 'coingecko', 'price_alert', 'bitcoin', '{"price": 45000, "change": 5.2, "volume": 25000000000}', 0.85, strftime('%s', 'now') - 3600, FALSE),
('signal_002', 'cryptopanic', 'sentiment_shift', 'ethereum', '{"sentiment": "bullish", "keywords": ["adoption", "growth"], "news_count": 15}', 0.72, strftime('%s', 'now') - 7200, FALSE),
('signal_003', 'defillama', 'tvl_anomaly', 'uniswap', '{"tvl": 5000000000, "change": 25.3, "chains": ["ethereum", "arbitrum"]}', 0.91, strftime('%s', 'now') - 1800, FALSE),
('signal_004', 'coinmarketcap', 'volume_anomaly', 'solana', '{"volume_24h": 3000000000, "change": 45.7, "market_cap": 25000000000}', 0.88, strftime('%s', 'now') - 5400, FALSE),
('signal_005', 'cryptopanic', 'sentiment_shift', 'cardano', '{"sentiment": "bearish", "keywords": ["concern", "delay"], "news_count": 8}', 0.65, strftime('%s', 'now') - 9000, FALSE);

-- Insert sample market data
INSERT INTO market_data (id, symbol, price, volume_24h, market_cap, price_change_24h, timestamp, source) VALUES
('market_001', 'BTC', 45000.00, 25000000000, 880000000000, 5.2, strftime('%s', 'now') - 300, 'coingecko'),
('market_002', 'ETH', 3200.00, 15000000000, 384000000000, 3.8, strftime('%s', 'now') - 300, 'coingecko'),
('market_003', 'SOL', 105.50, 3000000000, 25000000000, 45.7, strftime('%s', 'now') - 300, 'coinmarketcap'),
('market_004', 'ADA', 0.55, 500000000, 19000000000, -2.1, strftime('%s', 'now') - 300, 'coingecko'),
('market_005', 'DOT', 7.25, 800000000, 9000000000, 1.8, strftime('%s', 'now') - 300, 'coingecko');

-- Insert sample entity mentions
INSERT INTO entity_mentions (id, signal_id, entity_type, entity_name, mention_count, sentiment_score, timestamp) VALUES
('entity_001', 'signal_001', 'token', 'bitcoin', 25, 0.85, strftime('%s', 'now') - 3600),
('entity_002', 'signal_002', 'token', 'ethereum', 18, 0.72, strftime('%s', 'now') - 7200),
('entity_003', 'signal_003', 'protocol', 'uniswap', 12, 0.91, strftime('%s', 'now') - 1800),
('entity_004', 'signal_004', 'token', 'solana', 15, 0.88, strftime('%s', 'now') - 5400),
('entity_005', 'signal_005', 'token', 'cardano', 8, -0.65, strftime('%s', 'now') - 9000),
('entity_006', 'signal_002', 'exchange', 'binance', 5, 0.72, strftime('%s', 'now') - 7200),
('entity_007', 'signal_003', 'exchange', 'uniswap', 8, 0.91, strftime('%s', 'now') - 1800);

-- Insert sample transactions (x402 payments)
INSERT INTO transactions (id, tool_id, user_wallet, amount, currency, status, metadata, timestamp) VALUES
('tx_001', 'cryptointel-analysis', '0x1234567890abcdef1234567890abcdef12345678', 0.001, 'ETH', 'confirmed', '{"report_type": "comprehensive", "data_points": 150}', strftime('%s', 'now') - 86400),
('tx_002', 'cryptointel-analysis', '0xabcdef1234567890abcdef1234567890abcdef12', 0.001, 'ETH', 'confirmed', '{"report_type": "sentiment", "data_points": 75}', strftime('%s', 'now') - 43200),
('tx_003', 'cryptointel-signals', '0x7890abcdef1234567890abcdef1234567890abcd', 0.0005, 'ETH', 'confirmed', '{"signal_count": 25, "timeframe": "24h"}', strftime('%s', 'now') - 21600),
('tx_004', 'cryptointel-analysis', '0x34567890abcdef1234567890abcdef1234567890', 0.001, 'ETH', 'pending', '{"report_type": "comprehensive", "data_points": 200}', strftime('%s', 'now') - 3600);

-- Insert sample user analytics
INSERT INTO user_analytics (id, user_wallet, tool_id, action, metadata, timestamp) VALUES
('analytics_001', '0x1234567890abcdef1234567890abcdef12345678', 'cryptointel-analysis', 'view', '{"page": "dashboard", "duration": 180}', strftime('%s', 'now') - 86400),
('analytics_002', '0x1234567890abcdef1234567890abcdef12345678', 'cryptointel-analysis', 'purchase', '{"report_type": "comprehensive"}', strftime('%s', 'now') - 86400),
('analytics_003', '0xabcdef1234567890abcdef1234567890abcdef12', 'cryptointel-analysis', 'view', '{"page": "signals", "duration": 120}', strftime('%s', 'now') - 43200),
('analytics_004', '0xabcdef1234567890abcdef1234567890abcdef12', 'cryptointel-analysis', 'purchase', '{"report_type": "sentiment"}', strftime('%s', 'now') - 43200),
('analytics_005', '0x7890abcdef1234567890abcdef1234567890abcd', 'cryptointel-signals', 'view', '{"page": "signals", "duration": 90}', strftime('%s', 'now') - 21600),
('analytics_006', '0x7890abcdef1234567890abcdef1234567890abcd', 'cryptointel-signals', 'purchase', '{"signal_count": 25}', strftime('%s', 'now') - 21600);

-- Insert sample signal patterns
INSERT INTO signal_patterns (id, pattern_type, entities, pattern_data, confidence_score, valid_until) VALUES
('pattern_001', 'correlation', '["bitcoin", "ethereum"]', '{"correlation": 0.85, "timeframe": "24h", "strength": "strong"}', 0.85, strftime('%s', 'now') + 86400),
('pattern_002', 'anomaly', '["solana"]', '{"anomaly_type": "volume_spike", "magnitude": 45.7, "threshold": 20}', 0.91, strftime('%s', 'now') + 43200),
('pattern_003', 'trend', '["uniswap"]', '{"trend_direction": "bullish", "tvl_change": 25.3, "duration": "7d"}', 0.88, strftime('%s', 'now') + 172800),
('pattern_004', 'sentiment_shift', '["cardano"]', '{"sentiment_change": -0.65, "news_volume": 8, "timeframe": "24h"}', 0.72, strftime('%s', 'now') + 86400);

-- Insert sample API usage tracking
INSERT INTO api_usage (id, source, endpoint, request_count, response_time, status_code, timestamp) VALUES
('usage_001', 'coingecko', '/coins/bitcoin/market_data', 1, 245, 200, strftime('%s', 'now') - 300),
('usage_002', 'coinmarketcap', '/cryptocurrency/quotes/latest', 1, 189, 200, strftime('%s', 'now') - 300),
('usage_003', 'defillama', '/protocols', 1, 567, 200, strftime('%s', 'now') - 300),
('usage_004', 'cryptopanic', '/news/rss', 1, 123, 200, strftime('%s', 'now') - 300),
('usage_005', 'coingecko', '/coins/ethereum/market_data', 1, 198, 200, strftime('%s', 'now') - 600),
('usage_006', 'coingecko', '/coins/bitcoin/market_data', 1, 267, 200, strftime('%s', 'now') - 900);

-- Insert sample content generation queue
INSERT INTO content_queue (id, type, source_data, status, metadata) VALUES
('content_001', 'article', '{"signal_id": "signal_001", "topic": "bitcoin_price_analysis", "sentiment": "bullish"}', 'pending', '{"target_platform": "thepayoutstrategy", "word_count": 800}'),
('content_002', 'video_script', '{"signal_id": "signal_003", "topic": "uniswap_tvl_growth", "data_points": 12}', 'pending', '{"duration": 300, "style": "educational"}'),
('content_003', 'social_post', '{"signal_id": "signal_004", "topic": "solana_volume_spike", "platform": "twitter"}', 'pending', '{"hashtags": ["solana", "crypto", "defi"]}');