# Testing Free Data Sources

## Quick Test Commands

### 1. Health Check
```bash
# Local
curl http://localhost:8787/health

# Production
curl https://cryptointel-data.your-subdomain.workers.dev/health

# Expected Response
{
  "status": "healthy",
  "version": "2.0.0-free",
  "cost": "$0/month",
  "sources": [
    "coingecko_free",
    "defillama",
    "binance_public",
    "coincap",
    "kraken_public",
    "cryptopanic_rss"
  ],
  "message": "All data sources are FREE - no API keys required"
}
```

### 2. Manual Data Collection
```bash
# Trigger collection
curl -X POST http://localhost:8787/collect

# Expected Response
{
  "success": true,
  "timestamp": "2025-11-30T...",
  "cost": "$0",
  "api_keys_used": 0,
  "results": {
    "collected": 6,
    "signals": 25,
    "sources": {
      "coingecko_free": { ... },
      "binance_public": { ... },
      "coincap": { ... },
      "kraken_public": { ... },
      "defillama": { ... },
      "cryptopanic_rss": { ... }
    }
  }
}
```

### 3. View Signals
```bash
# Get all recent signals
curl http://localhost:8787/signals?limit=20

# Get specific signal type
curl http://localhost:8787/signals?type=volume_anomaly&limit=10

# Get signals for specific entity
curl http://localhost:8787/signals?entity=bitcoin&limit=10
```

### 4. Market Analysis
```bash
# Single symbol
curl http://localhost:8787/market-analysis?symbols=bitcoin

# Multiple symbols
curl http://localhost:8787/market-analysis?symbols=bitcoin,ethereum,solana
```

### 5. View Cached Market Data
```bash
# Check cache for bitcoin
curl http://localhost:8787/market-data/bitcoin

# Check cache for ethereum
curl http://localhost:8787/market-data/ethereum
```

### 6. View Dashboards
```bash
# Main dashboard
open http://localhost:8787/dashboard

# Intelligence dashboard
open http://localhost:8787/intelligence

# Enhanced dashboard
open http://localhost:8787/enhanced-dashboard
```

## Development Testing

### Start Local Server
```bash
npm run dev
# or
npm run local  # With persistent state
```

### Run Unit Tests
```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

### Run Integration Tests
```bash
npm run test:integration
```

### Lint Code
```bash
# Check for errors
npm run lint

# Auto-fix
npm run lint:fix
```

### Format Code
```bash
npm run format
```

## Deployment Testing

### Deploy to Production
```bash
npm run deploy
```

### Validate Deployment
```bash
# Windows
.\validate-deployment.bat

# Manual validation
curl https://cryptointel-data.your-subdomain.workers.dev/health
curl -X POST https://cryptointel-data.your-subdomain.workers.dev/collect
```

### Monitor Deployment
```bash
# Windows
.\monitor-deployment.bat

# View logs
npm run logs

# View metrics
npm run metrics
```

## Database Testing

### Check D1 Database
```bash
# View recent signals
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 10"

# View market data
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM market_data ORDER BY timestamp DESC LIMIT 10"

# View entity mentions
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM entity_mentions ORDER BY timestamp DESC LIMIT 10"

# Count signals by source
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT source, COUNT(*) as count FROM signals GROUP BY source"

# Count market data by source
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT source, COUNT(*) as count FROM market_data GROUP BY source"
```

### Check KV Cache
```bash
# List all keys
wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID

# Check specific cache key
wrangler kv:key get "market_data:bitcoin" --namespace-id=YOUR_NAMESPACE_ID

# List rate limit keys
wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID --prefix="rate_limit:"
```

## Testing Each Data Source

### CoinGecko Free
```javascript
// Manual test in browser console or node
const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&order=market_cap_desc&sparkline=false&price_change_percentage=24h';
const response = await fetch(url);
const data = await response.json();
console.log(data);
```

### Binance Public
```javascript
const url = 'https://api.binance.com/api/v3/ticker/24hr';
const response = await fetch(url);
const data = await response.json();
const btc = data.find(t => t.symbol === 'BTCUSDT');
console.log(btc);
```

### CoinCap
```javascript
const url = 'https://api.coincap.io/v2/assets?limit=10';
const response = await fetch(url);
const data = await response.json();
console.log(data.data);
```

### Kraken Public
```javascript
const url = 'https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD,XETHZUSD';
const response = await fetch(url);
const data = await response.json();
console.log(data.result);
```

### DeFi Llama
```javascript
const url = 'https://api.llama.fi/protocols';
const response = await fetch(url);
const data = await response.json();
console.log(data.slice(0, 5));
```

### CryptoPanic RSS
```javascript
const url = 'https://cryptopanic.com/news/rss';
const response = await fetch(url);
const text = await response.text();
console.log(text.substring(0, 500));
```

## Rate Limit Testing

### Check Rate Limits
```bash
# Should see rate limit keys in KV
wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID --prefix="rate_limit:"

# Example keys:
# rate_limit:coingecko_free:12345678
# rate_limit:binance_public:12345678
# rate_limit:coincap_free:12345678
# etc.
```

### Trigger Rate Limit (for testing)
```bash
# Rapid requests to trigger rate limit
for i in {1..35}; do
  curl http://localhost:8787/collect &
done
wait

# Should see "Rate limit exceeded" errors
```

## Signal Testing

### Check Signal Generation
```bash
# After collection, check signals
curl http://localhost:8787/signals?limit=50 | jq '.signals[] | {source, type, entity, confidence_score}'

# Expected signal types:
# - volume_anomaly (from market data)
# - price_alert (from market data)
# - tvl_anomaly (from DeFi Llama)
# - sentiment_shift (from CryptoPanic RSS)
```

### Verify Signal Sources
```bash
# Count signals by source
curl http://localhost:8787/signals?limit=1000 | jq '[.signals[] | .source] | group_by(.) | map({source: .[0], count: length})'

# Expected sources:
# - coingecko_free
# - binance_public
# - coincap
# - kraken_public
# - defillama
# - cryptopanic_rss
```

## Performance Testing

### Response Time Test
```bash
# Test health endpoint
time curl -s http://localhost:8787/health > /dev/null

# Test collection endpoint
time curl -s -X POST http://localhost:8787/collect > /dev/null

# Test signals endpoint
time curl -s http://localhost:8787/signals?limit=100 > /dev/null
```

### Cron Job Simulation
```bash
# Manually trigger scheduled job (local)
# This runs in the background every 15 minutes
# Check logs for "Running FREE scheduled data collection"
```

## Error Handling Testing

### Test Invalid Endpoints
```bash
# Should return 404
curl http://localhost:8787/invalid

# Should return 404
curl http://localhost:8787/dex/pairs  # Removed endpoint
```

### Test Missing Parameters
```bash
# Should work with defaults
curl http://localhost:8787/signals

# Should work with defaults
curl http://localhost:8787/market-analysis
```

## Integration Testing Script

Create a test script `test-free-sources.sh`:

```bash
#!/bin/bash

BASE_URL="${1:-http://localhost:8787}"

echo "Testing Free Data Sources at $BASE_URL"
echo "=========================================="

echo -e "\n1. Health Check..."
curl -s "$BASE_URL/health" | jq '.sources, .cost'

echo -e "\n2. Triggering Data Collection..."
curl -s -X POST "$BASE_URL/collect" | jq '.cost, .api_keys_used, .results.collected'

echo -e "\n3. Waiting for collection to complete..."
sleep 5

echo -e "\n4. Checking Signals..."
curl -s "$BASE_URL/signals?limit=10" | jq '.count, .signals[0]'

echo -e "\n5. Market Analysis..."
curl -s "$BASE_URL/market-analysis?symbols=bitcoin,ethereum" | jq '.analysis'

echo -e "\n6. Checking Cache..."
curl -s "$BASE_URL/market-data/bitcoin" | jq '.symbol, .price, .source'

echo -e "\nAll tests completed!"
```

Run with:
```bash
chmod +x test-free-sources.sh
./test-free-sources.sh http://localhost:8787
```

## Success Criteria

After testing, verify:

✅ Health check shows 6 free sources
✅ Health check shows $0 cost
✅ Collection returns data from all 6 sources
✅ Collection shows 0 API keys used
✅ Signals are generated
✅ Market data is cached
✅ Dashboards load successfully
✅ No API key errors in logs
✅ Rate limiting works correctly
✅ Error handling graceful

## Troubleshooting

### No Signals Generated
```bash
# Check if collection is running
curl -X POST http://localhost:8787/collect | jq '.results'

# Check database
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) FROM signals"
```

### Rate Limit Errors
```bash
# Wait 1 minute
sleep 60

# Try again
curl -X POST http://localhost:8787/collect
```

### Cache Not Working
```bash
# Check KV namespace binding in wrangler.toml
cat wrangler.toml | grep CRYPTOINTEL_CACHE

# Check cache keys
wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID
```

### API Errors
```bash
# Check logs
npm run logs

# Look for specific error messages
# - "Rate limit exceeded" = Too many requests
# - "API error: 429" = API rate limited
# - "API error: 404" = Wrong endpoint
# - "API error: 500" = API server error
```

## Monitoring

### Continuous Monitoring
```bash
# Tail logs
npm run logs

# Expected log messages:
# "Running FREE scheduled data collection (NO API KEYS)"
# "Collecting from CoinGecko Free..."
# "Collecting from Binance Public..."
# "Collecting from CoinCap..."
# "Collecting from Kraken Public..."
# "Collecting from DeFi Llama..."
# "Collecting from CryptoPanic RSS..."
# "FREE data collection completed: { cost: '$0', ... }"
```

### Analytics
```bash
# Check analytics dashboard
open http://localhost:8787/dashboard/api/stats

# Expected metrics:
# - Total signals
# - Signals by source
# - Collection success rate
# - Cache hit rate
```

## Documentation

For complete documentation, see:
- `FREE_DATA_SOURCES.md` - Implementation details
- `TICKET-002-COMPLETION.md` - Completion report
- `CLAUDE.md` - Development guide
- `README.md` - Project overview
