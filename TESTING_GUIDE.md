# Testing Guide
## CryptoIntel Data System Backend

Quick guide for testing the implemented backend infrastructure.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
npm install
```

### 2. Setup Environment
```bash
# Create D1 database
wrangler d1 create CRYPTOINTEL_DB

# Update wrangler.toml with the database_id returned

# Apply schema
npm run db:migrate

# (Optional) Set API keys
wrangler secret put COINMARKETCAP_API_KEY
```

### 3. Run Local Development
```bash
# Start local server (port 8787)
npm run dev

# OR with persistent state
npm run local
```

---

## 🧪 Testing Endpoints

### Health Check
```bash
curl http://localhost:8787/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-29T...",
  "version": "1.0.0",
  "sources": ["coingecko", "coinmarketcap", "coinmarketcap_dex", "defillama", "cryptopanic"]
}
```

### Trigger Data Collection
```bash
curl -X POST http://localhost:8787/collect
```

**Expected Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-29T...",
  "results": {
    "collected": 4,
    "signals": 15,
    "sources": {
      "coingecko": {...},
      "coinmarketcap": {...},
      "defillama": {...},
      "cryptopanic": {...}
    }
  }
}
```

### Get Signals
```bash
# All signals
curl http://localhost:8787/signals?limit=10

# Filter by type
curl http://localhost:8787/signals?type=volume_anomaly

# Filter by entity
curl http://localhost:8787/signals?entity=bitcoin&limit=5
```

### Get Market Analysis
```bash
curl "http://localhost:8787/market-analysis?symbols=bitcoin,ethereum"
```

### Get DEX Data
```bash
# DEX pairs
curl http://localhost:8787/dex/pairs

# DEX networks
curl http://localhost:8787/dex/networks

# DEX signals
curl http://localhost:8787/dex/signals?limit=20

# Volume leaders
curl http://localhost:8787/dex/volume-leaders?limit=10
```

### x402 Payment Test
```bash
# Without payment (should return 402)
curl -X POST http://localhost:8787/x402/analysis \
  -H "Content-Type: application/json" \
  -d '{}'

# With payment
curl -X POST http://localhost:8787/x402/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "test_tx_123",
    "wallet": "0x1234567890abcdef",
    "amount": 0.001,
    "reportType": "comprehensive"
  }'
```

### Get x402 Analytics
```bash
# Transaction history
curl http://localhost:8787/x402/transactions?limit=10

# Revenue analytics
curl http://localhost:8787/x402/analytics
```

---

## 🧪 Unit Tests

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run Specific Test
```bash
npm test -- test/index.test.js -t "should return healthy status"
```

### Watch Mode
```bash
npm test -- --watch
```

---

## 🔧 Integration Tests

### Run Integration Tests
```bash
npm run test:integration
```

### Run All Tests (Unit + Integration)
```bash
npm run test:all
```

---

## 📊 Database Testing

### Check Tables
```bash
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### Query Signals
```bash
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM signals LIMIT 5"
```

### Query Market Data
```bash
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM market_data LIMIT 5"
```

### Use Views
```bash
# Recent signals
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM recent_signals LIMIT 10"

# Market summary
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM market_summary"

# Top entities
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM top_entities LIMIT 10"
```

---

## 🔍 KV Cache Testing

### List KV Keys
```bash
wrangler kv:key list --namespace-id=crypto-intel-cache --prefix="market_data:"
```

### Get Cached Value
```bash
wrangler kv:key get "market_data:bitcoin" --namespace-id=crypto-intel-cache
```

### Delete Cache
```bash
wrangler kv:key delete "market_data:bitcoin" --namespace-id=crypto-intel-cache
```

---

## 📈 Monitoring

### Tail Logs
```bash
npm run logs
```

**Look for:**
- "Running scheduled data collection"
- "Database schema initialized successfully"
- "Data collection completed"
- Error messages

### Check Analytics
```bash
npm run metrics
```

---

## 🐛 Common Issues & Solutions

### Issue: "Rate limit exceeded"
**Solution:** Wait for the rate limit window to reset, or increase limits in configuration.

### Issue: "Database connection failed"
**Solution:**
```bash
# Verify D1 binding
wrangler d1 list

# Re-run migrations
npm run db:migrate
```

### Issue: "Missing market data in cache"
**Solution:**
```bash
# Trigger manual collection
curl -X POST http://localhost:8787/collect

# Check logs
npm run logs
```

### Issue: "API key not configured"
**Solution:**
```bash
# Set the required secrets
wrangler secret put COINMARKETCAP_API_KEY
```

---

## 🎯 Testing Checklist

### Core Functionality:
- [ ] Health check returns 200 OK
- [ ] Data collection completes successfully
- [ ] Signals are generated and stored
- [ ] Market data is cached in KV
- [ ] Rate limiting prevents API overuse
- [ ] Entity extraction works correctly

### API Endpoints:
- [ ] GET /health
- [ ] POST /collect
- [ ] GET /signals (with filters)
- [ ] GET /market-data/:symbol
- [ ] GET /market-analysis
- [ ] GET /dex/pairs
- [ ] GET /dex/signals
- [ ] POST /x402/analysis
- [ ] GET /x402/analytics

### Data Quality:
- [ ] CoinGecko data accurate
- [ ] CoinMarketCap data accurate
- [ ] DeFi Llama protocols tracked
- [ ] CryptoPanic news parsed correctly
- [ ] Signal confidence scores reasonable
- [ ] Entity extraction captures relevant entities

### Performance:
- [ ] Response times < 1000ms (good)
- [ ] Response times < 2000ms (acceptable)
- [ ] Cache hit rate > 50%
- [ ] No memory leaks
- [ ] Database queries optimized

### Error Handling:
- [ ] 402 returned for unpaid x402 requests
- [ ] 404 returned for invalid endpoints
- [ ] 500 returned with error details
- [ ] Rate limit errors handled gracefully
- [ ] API failures don't crash worker

---

## 🚀 Deployment Testing

### Test Staging
```bash
npm run deploy:staging
```

### Test Production
```bash
npm run deploy
```

### Verify Deployment
```bash
# Check production health
curl https://your-worker-name.workers.dev/health

# Trigger collection
curl -X POST https://your-worker-name.workers.dev/collect
```

---

## 📝 Test Data Examples

### Sample Signal Response:
```json
{
  "signals": [
    {
      "id": "volume_coingecko_BTC_1234567890",
      "source": "coingecko",
      "type": "volume_anomaly",
      "entity": "bitcoin",
      "data": {
        "current_volume": 50000000000,
        "average_volume": 20000000000,
        "volume_ratio": 2.5
      },
      "confidence_score": 0.85,
      "timestamp": 1732896000,
      "processed": false
    }
  ],
  "count": 1
}
```

### Sample Market Analysis Response:
```json
{
  "analysis": [
    {
      "symbol": "BTC",
      "price": 45000,
      "volume_24h": 25000000000,
      "market_cap": 880000000000,
      "price_change_24h": 5.2,
      "trend": "bullish"
    }
  ]
}
```

---

## 🎓 Next Steps

After testing backend:
1. Review test results
2. Fix any failing tests
3. Optimize performance bottlenecks
4. Deploy to staging
5. Monitor for 24 hours
6. Deploy to production
7. Hand off to frontend/dashboard agent

---

**Happy Testing!** 🚀
