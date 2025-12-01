# Data Sources Integration Guide

## Overview

The CryptoIntel Data System integrates with multiple cryptocurrency data sources to provide comprehensive market intelligence and signal detection.

## Supported Data Sources

### 1. CoinGecko API

**Endpoint:** https://api.coingecko.com/api/v3/

**Features:**
- Real-time price data
- Market capitalization and volume
- Trading pair information
- Historical price data
- Cryptocurrency descriptions and metadata

**Rate Limits:**
- Free tier: 10-30 requests per minute
- Pro tier: Up to 500 requests per minute

**Configuration:**
```bash
# Set API key (optional for enhanced features)
wrangler secret put COINGECKO_API_KEY

# Environment variables
COINGECKO_API_KEY=your_api_key_here
```

**Integration Status:** ✅ Complete
- Basic price data collection
- Market trend analysis
- Volume anomaly detection
- Price alert generation

---

### 2. CoinMarketCap API

**Endpoint:** https://pro-api.coinmarketcap.com/v1/

**Features:**
- Comprehensive market data
- Cryptocurrency listings
- Global market metrics
- Historical data
- DEX API suite (8 endpoints)

**Rate Limits:**
- Free tier: 10 requests per minute
- Pro tier: Up to 300 requests per minute
- DEX APIs: 1M free credits/month (soft launch)

**Configuration:**
```bash
# Set API key (required for full features)
wrangler secret put COINMARKETCAP_API_KEY

# Environment variables
COINMARKETCAP_API_KEY=your_api_key_here
```

**Integration Status:** ✅ Complete
- Basic market data collection
- DEX API integration (documentation complete)
- Global market metrics
- Historical trend analysis

---

### 3. DeFi Llama API

**Endpoint:** https://api.llama.fi/

**Features:**
- DeFi protocol TVL data
- Yield farming information
- Liquidity pool data
- Protocol rankings
- Chain-specific metrics

**Rate Limits:**
- Free tier: 100 requests per minute
- No API key required for basic usage

**Configuration:**
```bash
# No API key required for basic usage
# Optional: Pro features with API key
wrangler secret put DEFILLAMA_API_KEY
```

**Integration Status:** ✅ Complete
- TVL anomaly detection
- Protocol performance tracking
- Yield farming opportunities
- Cross-chain analysis

---

### 4. CryptoPanic RSS Feed

**Endpoint:** https://cryptopanic.com/api/rss/

**Features:**
- Real-time crypto news
- Market sentiment analysis
- News categorization
- Social media integration
- Fear & Greed Index

**Rate Limits:**
- RSS feed: Unlimited
- API (if used): 60 requests per minute

**Configuration:**
```bash
# No API key required for RSS feed
# Optional: API key for enhanced features
wrangler secret put CRYPTOPANIC_API_KEY
```

**Integration Status:** ✅ Complete
- News sentiment analysis
- Market fear/greed tracking
- News-based signal generation
- Entity extraction from news

---

## Data Collection Strategy

### Automated Collection

The system runs automated data collection every 15 minutes via cron jobs:

```bash
# Cron schedule in wrangler.toml
[triggers]
crons = ["*/15 * * * *"]
```

**Collection Process:**
1. **Market Data** - Fetch latest prices and volumes
2. **News Analysis** - Process RSS feeds for sentiment
3. **TVL Monitoring** - Check DeFi protocol changes
4. **Signal Detection** - Identify anomalies and patterns
5. **Entity Extraction** - Extract tokens, exchanges, wallets
6. **Database Storage** - Store processed data with indexes

### Rate Limiting Strategy

**Intelligent Rate Limiting:**
- KV-based windowed rate limiting
- Per-source rate limit configuration
- Exponential backoff retry logic
- 5-minute cache TTL for market data

**Cache Strategy:**
- Market data: 5 minutes
- News data: 15 minutes
- TVL data: 30 minutes
- Entity mentions: 1 hour

---

## Signal Generation

### Signal Types

#### 1. Price Alerts
- **Trigger:** Significant price movements (>5% in 1 hour)
- **Sources:** CoinGecko, CoinMarketCap
- **Confidence:** Based on volume and market cap

#### 2. Volume Anomalies
- **Trigger:** Unusual trading volume spikes
- **Sources:** All market data sources
- **Confidence:** Based on historical averages

#### 3. TVL Anomalies
- **Trigger:** Significant TVL changes in DeFi protocols
- **Sources:** DeFi Llama
- **Confidence:** Based on protocol size and history

#### 4. Sentiment Shifts
- **Trigger:** Major sentiment changes in news
- **Sources:** CryptoPanic
- **Confidence:** Based on news volume and sources

---

## Error Handling

### Resilience Features

1. **Graceful Degradation**
   - Continue operating if one source fails
   - Use cached data during outages
   - Log all errors for debugging

2. **Retry Logic**
   - Exponential backoff for failed requests
   - Maximum 3 retry attempts
   - Different delays per source

3. **Data Validation**
   - Validate all incoming data structures
   - Handle missing or null fields gracefully
   - Implement data type checking

### Monitoring

**Health Checks:**
- API response time monitoring
- Error rate tracking
- Data freshness validation
- Rate limit utilization

**Alerts:**
- API key expiration warnings
- Rate limit exceeded notifications
- Data quality issues
- Service outage detection

---

## Configuration Examples

### Complete Environment Setup

```bash
# CoinGecko (optional)
wrangler secret put COINGECKO_API_KEY

# CoinMarketCap (recommended)
wrangler secret put COINMARKETCAP_API_KEY

# DeFi Llama (optional)
wrangler secret put DEFILLAMA_API_KEY

# CryptoPanic (optional)
wrangler secret put CRYPTOPANIC_API_KEY

# Deploy with all sources
npm run deploy
```

### Local Development

```javascript
// src/index.js - Data source configuration
const DATA_SOURCES = {
  coingecko: {
    enabled: true,
    apiKey: env.COINGECKO_API_KEY,
    rateLimit: 30 // requests per minute
  },
  coinmarketcap: {
    enabled: true,
    apiKey: env.COINMARKETCAP_API_KEY,
    rateLimit: 30
  },
  defillama: {
    enabled: true,
    apiKey: env.DEFILLAMA_API_KEY,
    rateLimit: 100
  },
  cryptopanic: {
    enabled: true,
    apiKey: env.CRYPTOPANIC_API_KEY,
    rateLimit: 60
  }
};
```

---

## Performance Optimization

### Best Practices

1. **Batch Requests**
   - Combine multiple data points in single calls
   - Use bulk endpoints where available
   - Reduce API call overhead

2. **Intelligent Caching**
   - Cache frequently accessed data
   - Use appropriate TTL per data type
   - Implement cache invalidation

3. **Rate Limit Management**
   - Track remaining requests
   - Implement backoff strategies
   - Use multiple API keys if needed

4. **Data Prioritization**
   - Prioritize high-value data sources
   - Focus on high-impact signals
   - Optimize for user needs

---

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   ```bash
   # Check current usage
   wrangler tail | grep "rate limit"
   
   # Solution: Implement better caching
   ```

2. **API Key Issues**
   ```bash
   # Verify API keys are set
   wrangler secret list
   
   # Solution: Update expired keys
   ```

3. **Data Quality Issues**
   ```bash
   # Check recent data quality
   wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) FROM signals WHERE confidence_score < 0.5"
   
   # Solution: Adjust confidence thresholds
   ```

### Debug Mode

```bash
# Enable debug logging
wrangler dev --log-level debug

# Monitor data collection
npm run logs | grep "collect"
```

---

## Future Enhancements

### Planned Data Sources

1. **Messari API**
   - Institutional-grade data
   - Advanced analytics endpoints
   - Professional market insights

2. **Glassnode API**
   - On-chain metrics
   - Blockchain analytics
   - Network health data

3. **Twitter/X API**
   - Social sentiment analysis
   - Influencer tracking
   - Real-time social signals

### Advanced Features

1. **WebSocket Integration**
   - Real-time price feeds
   - Live sentiment updates
   - Instant signal delivery

2. **ML Enhancement**
   - Pattern recognition models
   - Predictive analytics
   - Anomaly detection improvement

---

**Last Updated:** 2025-11-30  
**Integration Status:** All core sources complete  
**Next Review:** Post-DEX integration completion