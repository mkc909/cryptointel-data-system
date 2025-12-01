# CryptoIntel Data System - Deployment Guide

## 🚀 Quick Deploy

**All bugs are FIXED and code is READY!** Just run:

```bash
# Windows Command Prompt or PowerShell
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
.\deploy.bat
```

This will:
1. ✅ Check environment (npm, wrangler)
2. ✅ Apply database migrations
3. ✅ Deploy to Cloudflare Workers
4. ✅ Show deployment status

---

## 📋 Manual Deployment Steps

If you prefer to run commands manually:

### 1. Navigate to Project
```bash
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
```

### 2. Apply Database Migrations
```bash
npm run db:migrate
```

This applies the schema from `schema.sql` to your D1 database.

### 3. Set Secrets (Optional but Recommended)
```bash
# CoinMarketCap API key (required for CMC data)
wrangler secret put COINMARKETCAP_API_KEY

# CoinGecko API key (optional, enhances rate limits)
wrangler secret put COINGECKO_API_KEY
```

### 4. Deploy to Production
```bash
npm run deploy
```

### 5. Verify Deployment
```bash
wrangler deployments list
```

---

## 🔍 Post-Deployment Testing

### Test Endpoints

**Health Check:**
```bash
curl https://cryptointel-data-production.workers.dev/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-29T...",
  "version": "1.0.0",
  "sources": ["coingecko", "coinmarketcap", "defillama", "cryptopanic"]
}
```

**Trigger Data Collection:**
```bash
curl -X POST https://cryptointel-data-production.workers.dev/collect
```

**Get Signals:**
```bash
curl https://cryptointel-data-production.workers.dev/signals?limit=10
```

**View Dashboard:**
Open in browser:
```
https://cryptointel-data-production.workers.dev/enhanced-dashboard
```

---

## ✅ What Was Fixed Before Deployment

### Critical Bugs (9 Fixed)
1. ✅ DeFi Llama signal insertion SQL parameter mismatch
2. ✅ Sentiment analysis division by zero
3. ✅ Entity mention SQL parameter count error
4. ✅ Dashboard environment variable access (2 locations)
5. ✅ Timestamp format mismatches (3 locations)
6. ✅ Transaction replay protection added

### Files Modified
- `src/index.js` - 6 bug fixes
- `src/dashboard.js` - 2 bug fixes
- `src/enhanced-dashboard.js` - 2 bug fixes

### Security Enhancements
- ✅ Transaction replay protection (prevents duplicate payments)
- ✅ HTTP 409 returned for already-processed transactions
- ✅ Transaction ID properly stored in database

---

## 📊 What's Deployed

### Data Sources (4)
- ✅ CoinGecko - Market data + volume anomalies
- ✅ CoinMarketCap - Quotes + DEX data (8 endpoints)
- ✅ DeFi Llama - TVL tracking + protocol analytics
- ✅ CryptoPanic - News sentiment analysis

### Signal Types (9)
- sentiment_shift
- volume_anomaly
- tvl_anomaly
- price_alert
- dex_volume_anomaly
- dex_new_pair
- dex_liquidity_shift
- dex_price_volatility
- dex_liquidity_risk

### API Endpoints (20+)
- Health & monitoring
- Data collection triggers
- Signal retrieval & filtering
- Market analysis
- DEX analytics (8 endpoints)
- x402 payment integration (3 endpoints)
- Dashboard APIs (6 endpoints)

### Features
- ✅ Real-time dashboard with auto-refresh (30s)
- ✅ 4 interactive charts (Chart.js)
- ✅ Advanced filtering (type, entity, confidence)
- ✅ x402 payment verification
- ✅ Transaction logging & analytics
- ✅ Rate limiting (30 req/min per source)
- ✅ KV caching (5-min TTL)
- ✅ Scheduled cron jobs (15-min intervals)

---

## 🔧 Troubleshooting

### Deployment Fails

**Error: "Authentication required"**
```bash
wrangler login
```

**Error: "Database not found"**
```bash
# Create D1 database
wrangler d1 create CRYPTOINTEL_DB

# Update wrangler.toml with database_id
# Then run migration again
npm run db:migrate
```

**Error: "KV namespace not found"**
```bash
# Create KV namespace
wrangler kv:namespace create CRYPTOINTEL_CACHE

# Update wrangler.toml with namespace_id
```

### Dashboard Shows No Data

**Trigger manual data collection:**
```bash
curl -X POST https://cryptointel-data-production.workers.dev/collect
```

**Check cron job:**
```bash
wrangler tail
# Look for "Running scheduled data collection" messages
```

**Check database:**
```bash
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) FROM signals"
```

### Rate Limit Errors

**Check rate limit status:**
```bash
wrangler kv:key list --namespace-id=<your-namespace-id> --prefix="rate_limit:"
```

**Clear rate limits (dev only):**
```bash
wrangler kv:key delete "rate_limit:coingecko:..." --namespace-id=<your-namespace-id>
```

---

## 📈 Monitoring

### View Live Logs
```bash
npm run logs
# or
wrangler tail
```

### Check Analytics
```bash
npm run metrics
# Opens Cloudflare dashboard analytics
```

### Database Queries
```bash
# Count signals
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) FROM signals"

# Recent signals
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM recent_signals LIMIT 10"

# Transaction revenue
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM transaction_summary"
```

---

## 🎯 Success Criteria

After deployment, verify:

- [ ] Health endpoint returns 200 OK
- [ ] Data collection works (POST /collect returns signals)
- [ ] Dashboard loads and shows data
- [ ] Charts render correctly
- [ ] Signals filter by type/entity
- [ ] x402 payment endpoint returns 402 when no payment
- [ ] Transaction replay returns 409 for duplicates
- [ ] Cron job runs every 15 minutes (check logs)

---

## 💰 Cost Monitoring

**Expected Monthly Costs: ~$5**

- Cloudflare Workers Paid: $5/month
- D1 database: Free tier (first 5GB)
- KV storage: Free tier (first 1GB)
- External APIs: Free tiers only

**Monitor usage:**
```bash
wrangler metrics
```

---

## 🔄 Rollback

If deployment fails or has issues:

```bash
# View recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

---

## 📞 Support

**Documentation:**
- Main guide: `CLAUDE.md`
- Backend details: `BACKEND_IMPLEMENTATION_REPORT.md`
- Dashboard guide: `docs/dashboard-guide.md`
- Testing guide: `TEST_DOCUMENTATION.md`

**Logs:**
- Real-time: `wrangler tail`
- Dashboard: https://dash.cloudflare.com/

---

**Ready to deploy? Run `.\deploy.bat` now!** 🚀
