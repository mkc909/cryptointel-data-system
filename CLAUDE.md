# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-source crypto intelligence data collection and analysis system built on Cloudflare Workers. Collects real-time market signals from CoinGecko, CoinMarketCap, DeFi Llama, and CryptoPanic, with x402 payment integration for monetized analysis endpoints.

**Tech Stack:** Cloudflare Workers, Hono.js, D1 (SQLite), KV (cache), Vitest, ESM modules

## Essential Commands

### Development

```bash
npm run dev                # Start local development server (port 8787)
npm run local             # Development with persistent state (.wrangler/state)
```

### Database Operations

```bash
npm run db:migrate        # Apply schema.sql to D1 database
npm run db:seed          # Load seed data from seed.sql
npm run db:backup        # Export database to backup.sql

# Manual D1 queries
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM signals LIMIT 10"
wrangler d1 execute CRYPTOINTEL_DB --local --command "SELECT * FROM signals"  # Local D1
```

### Testing

```bash
npm test                  # Run unit tests (Vitest)
npm run test:integration  # Run integration tests (scripts/test.sh)
npm run test:coverage     # Unit tests with coverage report
npm run test:all         # Both unit and integration tests

# Run specific test or test suite
npm test -- test/index.test.js -t "should return healthy status"
npm test -- --grep "x402"  # Run all tests matching pattern
```

### Deployment

```bash
npm run deploy           # Deploy to production
npm run deploy:staging   # Deploy to staging environment
npm run build           # Lint + run all tests (pre-deploy check)

# Deployment monitoring scripts (Windows)
.\deploy.bat                    # Automated deployment with validation
.\validate-deployment.bat       # Post-deployment validation
.\monitor-deployment.bat        # Continuous monitoring
```

### Code Quality

```bash
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix linting issues
npm run format          # Prettier formatting
```

### Monitoring

```bash
npm run logs            # Tail live logs (wrangler tail)
npm run metrics         # View analytics dashboard
```

## Architecture

### Request Flow

```
External APIs (CoinGecko, CMC, etc.)
    ↓
Data Collection Functions (fetchCoinGeckoData, fetchDeFiLlamaData, etc.)
    ↓
Rate Limiter (KV-based) + Signal Processing
    ↓
D1 Database Storage (signals, market_data, entity_mentions, DEX tables)
    ↓
API Endpoints (Hono routes) + KV Cache (5-minute TTL)
    ↓
x402 Integration / Dashboards / External Consumers
```

### Core Components

**[src/index.js](src/index.js)** - Main application entry point (~2500+ lines)
- Hono app with API routes and middleware
- Data source integrations (CoinGecko, CoinMarketCap, DeFi Llama, CryptoPanic)
- DEX API integration (8 CoinMarketCap v4 endpoints)
- Signal detection and entity extraction
- x402 payment verification and transaction logging
- Scheduled cron handler (runs every 15 minutes)
- Rate limiting implementation with RateLimiter class

**[src/dashboard.js](src/dashboard.js)** - Analytics dashboard
- HTML dashboard interface with real-time updates
- Stats API endpoints for metrics
- Transaction and market data visualization
- Signal monitoring interface

**[src/intelligence-dashboard.js](src/intelligence-dashboard.js)** - Advanced analytics
- Enhanced intelligence features
- Pattern recognition visualization
- Historical trend analysis

**[src/enhanced-dashboard.js](src/enhanced-dashboard.js)** - Performance-optimized dashboard
- Optimized queries using 29+ database indexes
- Real-time WebSocket-like updates
- Advanced filtering and aggregation

### Database Schema ([schema.sql](schema.sql))

**Core Tables:**
- `signals` - All detected signals (sentiment shifts, volume anomalies, TVL changes, price alerts)
- `market_data` - Current and historical market information
- `entity_mentions` - Entity frequency and sentiment tracking
- `transactions` - x402 payment tracking for intelligence
- `user_analytics` - User behavior analytics
- `signal_patterns` - ML pattern storage for training
- `api_usage` - Rate limit and performance monitoring
- `content_queue` - Automated content generation queue

**DEX-Specific Tables (CoinMarketCap v4):**
- `dex_pairs` - Decentralized exchange trading pairs
- `dex_networks` - Blockchain network information
- `dex_signals` - DEX-specific trading signals
- `dex_trades` - Recent trade data
- `dex_listings` - DEX exchange information

**Performance Indexes:**
- 29+ composite indexes for 10-20x query improvement
- Covering indexes for high-frequency queries
- Optimized for time-series and aggregation operations

**Views for Common Queries:**
- `recent_signals` - Last 24 hours with entity data
- `market_summary` - 24-hour aggregated market metrics
- `transaction_summary` - Revenue by tool and currency
- `top_entities` - Most mentioned entities (7-day window)
- `dex_volume_leaders` - Top DEX pairs by volume
- `dex_recent_signals` - Latest DEX trading signals

### Environment Bindings

**Required:**
- `CRYPTOINTEL_DB` - D1 database binding (defined in wrangler.toml)
- `CRYPTOINTEL_CACHE` - KV namespace for caching and rate limiting

**Optional (Secrets):**
- `COINGECKO_API_KEY` - CoinGecko Pro API key (enhanced features)
- `COINMARKETCAP_API_KEY` - CoinMarketCap API key (required for CMC data and DEX APIs)

**Set secrets:**
```bash
wrangler secret put COINGECKO_API_KEY
wrangler secret put COINMARKETCAP_API_KEY
```

## Key Implementation Patterns

### Rate Limiting

All external API calls use KV-based rate limiting with the `RateLimiter` class:
- Default: 30 requests per minute window
- DEX APIs: 300 requests per minute
- Per-source configuration in `DATA_SOURCES` object
- Returns `{ allowed: boolean, remaining?: number, resetTime?: number }`

**Example:**
```javascript
const rateLimiter = new RateLimiter(env.CRYPTOINTEL_CACHE, 30, 60000);
const limitCheck = await rateLimiter.checkLimit('coingecko');
if (!limitCheck.allowed) {
  return { error: 'Rate limit exceeded', resetTime: limitCheck.resetTime };
}
```

### Data Caching

Market data is cached in KV with 5-minute TTL:
```javascript
await env.CRYPTOINTEL_CACHE.put(`market_data:${symbol}`, JSON.stringify(data), {
  expirationTtl: 300
});
```

### Signal Detection

Four main signal types:
1. **sentiment_shift** - CryptoPanic news analysis with keyword extraction
2. **tvl_anomaly** - DeFi protocol TVL changes >20%
3. **volume_anomaly** - Unusual trading volume patterns
4. **price_alert** - Significant price movements

DEX-specific signals:
- **dex_volume_anomaly** - Abnormal DEX trading volume
- **dex_new_pair** - New trading pair listings
- **dex_liquidity_shift** - Major liquidity changes

Signals include `confidence_score` (0.0-1.0) for AI-powered filtering.

### Entity Extraction

Automatically identifies and tracks:
- **Tokens:** bitcoin, ethereum, solana, etc.
- **Exchanges:** binance, coinbase, uniswap, etc.
- **Wallets:** Ethereum addresses (0x[40 hex chars])
- **Protocols:** DeFi protocols from DeFi Llama

Stored in `entity_mentions` table with sentiment scoring.

### x402 Payment Integration

Payment verification flow:
1. Check `transactionId` presence in request
2. Return 402 Payment Required if missing
3. Verify transaction with x402 ecosystem
4. Generate analysis report if payment verified
5. Log transaction to `transactions` table for revenue tracking

**Endpoint:** `POST /x402/analysis`

### Error Handling Pattern

Consistent error handling across all endpoints:
```javascript
try {
  // Operation code
} catch (error) {
  console.error(`Operation failed:`, error);
  return c.json({
    error: 'Operation failed',
    details: error.message
  }, 500);
}
```

## API Endpoints

**Core Data:**
- `GET /health` - Health check with version and sources
- `POST /collect` - Trigger manual data collection from all sources
- `GET /signals?limit=50&type=sentiment_shift&entity=bitcoin` - Retrieve signals with filters
- `GET /market-analysis?symbols=bitcoin,ethereum` - Multi-symbol market analysis
- `GET /market-data/:symbol` - Cached market data for specific symbol

**DEX APIs:**
- `GET /dex/spot-pairs` - Latest DEX spot trading pairs
- `GET /dex/networks` - Available blockchain networks
- `GET /dex/listings` - DEX exchange listings
- `GET /dex/historical/:pairId` - Historical OHLCV data
- `GET /dex/analysis` - Comprehensive DEX market analysis

**x402 Integration:**
- `POST /x402/analysis` - Paid comprehensive analysis (requires payment verification)
- `GET /x402/transactions?limit=50&tool_id=cryptointel-analysis` - Transaction history
- `GET /x402/analytics` - Revenue analytics (by tool, daily trends, top users)

**Dashboards:**
- `GET /dashboard` - Main analytics dashboard
- `GET /intelligence-dashboard` - Advanced intelligence features
- `GET /enhanced-dashboard` - Performance-optimized dashboard
- `GET /dashboard/api/stats` - Dashboard statistics
- `GET /dashboard/api/signals` - Real-time signals
- `GET /dashboard/api/transactions` - Transaction data
- `GET /dashboard/api/market` - Market data

## Scheduled Cron Jobs

Defined in `wrangler.toml`:
```toml
[triggers]
crons = ["*/15 * * * *"]  # Every 15 minutes
```

Implemented in `scheduled()` export handler:
1. Initializes database tables if needed
2. Collects data from all configured sources
3. Detects and processes signals
4. Performs entity extraction
5. Updates market data cache
6. Logs collection metrics

## Testing Strategy

**Unit Tests ([test/index.test.js](test/index.test.js)):**
- Mock environment with `CRYPTOINTEL_DB` and `CRYPTOINTEL_CACHE` bindings
- Test suites: Health Check, Market Data Collection, Signal Processing, DEX APIs, x402 Integration, Rate Limiting, Error Handling, CORS
- Uses Vitest with Miniflare environment for Workers runtime simulation
- 30+ test cases covering core functionality

**Integration Tests ([scripts/test.sh](scripts/test.sh)):**
- Bash script that tests deployed or local Worker
- Functional tests: health checks, data collection, signals, market data, x402 payments, dashboard APIs
- Performance tests: response time benchmarks (<1000ms good, <2000ms acceptable)
- Error handling tests: invalid endpoints, malformed JSON, missing parameters
- Requires `curl` and optionally `jq` for JSON formatting

**Testing Patterns:**
```javascript
// Mock fetch for API testing
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'test' })
});

// Mock D1 database
const mockDB = {
  prepare: () => ({
    bind: () => ({
      run: () => Promise.resolve({ success: true }),
      all: () => Promise.resolve({ results: [] })
    })
  })
};
```

## Data Source Configuration

Located in `getDataSources(env)` function:

**CoinGecko:**
- Base URL: `https://api.coingecko.com/api/v3`
- Rate limit: 30 calls/minute
- Key endpoints: `/simple/price`, `/coins/{id}/market_chart`

**CoinMarketCap (v1 & v4):**
- Base URL v1: `https://pro-api.coinmarketcap.com/v1`
- Base URL v4: `https://pro-api.coinmarketcap.com/v4`
- Rate limit: 30 calls/minute (v1), 300 calls/minute (v4)
- DEX endpoints documented in [docs/coinmarketcap-dex-apis.md](docs/coinmarketcap-dex-apis.md)

**DeFi Llama:**
- Base URL: `https://api.llama.fi`
- Rate limit: 100 calls/minute
- Key endpoints: `/protocols`, `/tvl/{protocol}`

**CryptoPanic:**
- RSS URL: `https://cryptopanic.com/news/rss`
- Rate limit: 60 calls/minute
- Provides news sentiment and headlines

## Development Workflow

### Adding New Data Source

1. Add configuration to `DATA_SOURCES` object in `getDataSources()`
2. Create `fetch{Source}Data(env)` function with rate limiting
3. Implement signal detection in the fetch function
4. Add entity extraction logic if applicable
5. Store data in appropriate D1 tables
6. Add caching logic with KV
7. Add unit tests in `test/index.test.js`
8. Update integration tests in `scripts/test.sh`
9. Document the new source in this file

### Database Schema Changes

1. Update `schema.sql` with new tables/columns/indexes
2. Run `npm run db:migrate` locally
3. Test with `npm run local` (uses `.wrangler/state`)
4. Add any new views or triggers
5. Update seed data in `seed.sql` if needed
6. Deploy to staging first for validation

### Performance Optimization

Key areas to focus on:
- Database indexes (already 29+ optimized indexes)
- KV cache TTL configuration (default 5 minutes)
- Rate limiter window sizes
- Batch database operations where possible
- Use database views for complex queries

## Environment Configuration

**Development:**
```toml
[env.development]
vars = { ENVIRONMENT = "development" }
```

**Production:**
```toml
[env.production]
name = "cryptointel-data-production"
vars = { ENVIRONMENT = "production" }
```

**Staging (if configured):**
```toml
[env.staging]
name = "cryptointel-data-staging"
vars = { ENVIRONMENT = "staging" }
```

## Common Operations

### Query Operations

**Recent signals with high confidence:**
```sql
SELECT * FROM signals
WHERE confidence_score > 0.7
  AND timestamp > strftime('%s', 'now', '-1 hour')
ORDER BY confidence_score DESC
```

**Top entities by mentions:**
```sql
SELECT entity_name, COUNT(*) as mentions, AVG(sentiment_score) as avg_sentiment
FROM entity_mentions
WHERE timestamp > strftime('%s', 'now', '-24 hours')
GROUP BY entity_name
ORDER BY mentions DESC
LIMIT 10
```

### Cache Management

```bash
# List all cache keys
wrangler kv:key list --namespace-id=crypto-intel-cache

# Clear specific cache pattern
wrangler kv:key list --namespace-id=crypto-intel-cache --prefix="market_data:" | xargs -I {} wrangler kv:key delete {} --namespace-id=crypto-intel-cache
```

### Monitoring Cron Jobs

```bash
# Check last cron execution
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM api_usage WHERE endpoint = 'scheduled' ORDER BY timestamp DESC LIMIT 5"

# Monitor real-time logs during cron window
npm run logs
```

## Troubleshooting

**Rate limit exceeded:**
- Check rate limit key in KV: `rate_limit:{source}:{timestamp}`
- Verify rate limit configuration in `DATA_SOURCES`
- Consider implementing exponential backoff

**Database locked errors:**
- Indicates concurrent write operations
- Implement retry logic with exponential backoff
- Consider using transactions for related operations

**Missing DEX data:**
- Verify COINMARKETCAP_API_KEY is set
- Check DEX API endpoints are accessible
- Review DEX-specific rate limits (300/min)

**Deployment validation failures:**
- Run `validate-deployment.bat` for detailed checks
- Verify all environment variables are set
- Check D1 database migrations are applied

**Performance issues:**
- Review slow query logs in `api_usage` table
- Check if appropriate indexes exist
- Consider increasing KV cache TTL for stable data
- Use enhanced-dashboard for optimized queries