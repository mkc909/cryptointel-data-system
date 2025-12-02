# Deployment Guide - Version 2 (Fixed)

## What's Fixed in V2

### Critical Fixes
1. ✅ **Dashboard Stats** - No longer JOINs with empty entity_mentions table
2. ✅ **Binance API** - Replaced with Kraken (HTTP 451 blocked → working alternative)
3. ✅ **CoinCap API** - Replaced with Messari (timeout → working alternative)
4. ✅ **Realistic Success Rate** - Honest 60-70% tracking, not fake 100%
5. ✅ **Better Error Messages** - Clear feedback on what's working vs broken

### Dashboard Stats Fix

**Old Code (Broken):**
```javascript
// Relied on entity_mentions table which was always empty
const stats = await db.query(`
  SELECT s.*, em.entity_name
  FROM signals s
  LEFT JOIN entity_mentions em ON s.id = em.signal_id  // Problem!
`);
```

**New Code (Working):**
```javascript
// Queries signals directly, entity_mentions is optional
const signalsBySource = await db.prepare(
  'SELECT source, COUNT(*) as count FROM signals GROUP BY source'
).all();

const totalSignals = await db.prepare(
  'SELECT COUNT(*) as count FROM signals'
).first();

// Entity mentions are separate and optional
const entities = await db.prepare(
  'SELECT entity_name, COUNT(*) as mentions
   FROM entity_mentions
   GROUP BY entity_name
   ORDER BY mentions DESC
   LIMIT 10'
).all();
```

## Quick Deployment

### Option 1: Deploy with Existing Wrangler Config

```bash
# Navigate to project
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

# Install dependencies (if not already)
npm install

# Build and deploy
npm run deploy
```

### Option 2: Deploy V2 Specifically

Create a new `wrangler-v2.toml`:

```toml
name = "cryptointel-data-v2"
main = "src/index-free-v2.js"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "CRYPTOINTEL_DB"
database_name = "cryptointel-db"
database_id = "your-database-id-here"

[[kv_namespaces]]
binding = "CRYPTOINTEL_CACHE"
id = "your-kv-namespace-id-here"

[triggers]
crons = ["*/15 * * * *"]
```

Deploy with:
```bash
wrangler deploy --config wrangler-v2.toml
```

## Step-by-Step Deployment

### Step 1: Backup Current Deployment

```bash
# Export current database
wrangler d1 export CRYPTOINTEL_DB --output backup-$(date +%Y%m%d).sql

# Note current worker URL
wrangler deployments list
```

### Step 2: Update Configuration

Edit `wrangler.toml`:
```toml
# Change main entry point
main = "src/index-free-v2.js"

# OR keep both versions:
# main = "src/index-free-fixed.js"  # Old version
# main = "src/index-free-v2.js"     # New version (recommended)
```

### Step 3: Test Locally First

```bash
# Start local development server
npm run dev

# In another terminal, test endpoints
curl http://localhost:8787/health

# Test dashboard stats (should show data now)
curl http://localhost:8787/dashboard/api/stats

# Trigger collection
curl -X POST http://localhost:8787/collect

# Check signals
curl http://localhost:8787/signals?limit=10
```

### Step 4: Verify Dashboard Stats

```bash
# After local testing, check dashboard stats
curl http://localhost:8787/dashboard/api/stats | jq

# Expected response (with actual data):
{
  "signals": {
    "bySource": [
      {"source": "coingecko", "count": 5},
      {"source": "defillama", "count": 2}
    ],
    "byType": [
      {"type": "price_alert", "count": 3},
      {"type": "volume_anomaly", "count": 4}
    ],
    "total": 7,
    "last24h": 7
  },
  "market": {
    "symbols_tracked": 10,
    "data_points": 50,
    "recent": [...]
  },
  "entities": [],  // Can be empty - that's OK now
  "note": "Entity mentions may be empty - signals are independent"
}
```

### Step 5: Deploy to Production

```bash
# Deploy
npm run deploy

# Or with specific config
wrangler deploy --config wrangler-v2.toml

# Monitor deployment
wrangler tail
```

### Step 6: Post-Deployment Validation

```bash
# Test production endpoint
WORKER_URL="https://cryptointel-data.your-subdomain.workers.dev"

# Health check
curl $WORKER_URL/health

# Should show v2 version
{
  "status": "healthy",
  "version": "2.2.0-free-v2-honest",
  "sources": [
    "coingecko_free",
    "defillama",
    "kraken_public",      // New: replaces Binance
    "messari_free",       // New: replaces CoinCap
    "alternative_me",
    "cryptocompare_free"
  ],
  "improvements": [
    "Fixed dashboard stats (no JOIN on empty tables)",
    "Replaced blocked APIs with working alternatives",
    ...
  ]
}

# Trigger first collection
curl -X POST $WORKER_URL/collect

# Wait 30 seconds for collection to complete
sleep 30

# Check dashboard stats
curl $WORKER_URL/dashboard/api/stats

# Should show actual signal counts now!
```

## Verification Checklist

After deployment, verify:

- [ ] Health endpoint returns v2.2.0-free-v2-honest
- [ ] Health shows 6 sources (not including removed Binance/CoinCap)
- [ ] POST /collect completes without errors
- [ ] Dashboard stats shows actual signal counts (not empty)
- [ ] Signals endpoint returns data
- [ ] Market data endpoint returns data
- [ ] Dashboard page loads
- [ ] No errors in logs (`wrangler tail`)
- [ ] Success rate shows realistic 60-70%
- [ ] Cron job runs every 15 minutes

## Rollback Plan

If something goes wrong:

```bash
# Rollback to previous version
wrangler rollback

# Or restore from backup
wrangler d1 execute CRYPTOINTEL_DB --file=backup-YYYYMMDD.sql

# Or change wrangler.toml back to old version
# main = "src/index-free-fixed.js"
# Then redeploy
wrangler deploy
```

## Migration Notes

### Database Changes
**None required** - V2 uses the same schema as V1. The fix is in the query logic, not the schema.

### Breaking Changes
**None** - V2 is backwards compatible. All endpoints work the same, just with better data.

### New Features
- Dashboard stats actually work now
- Realistic success rate reporting
- Better error messages
- Working API alternatives

## Monitoring After Deployment

### Check Logs
```bash
# Tail logs in real-time
wrangler tail

# Look for:
# "Running scheduled FREE data collection V2 at: ..."
# "V2 data collection summary: ..."
# Success rate messages
```

### Monitor Success Rate
```bash
# Check collection status
curl $WORKER_URL/collection-status | jq '.success_rate'

# Should show realistic 60-70%, not fake 100%
```

### Dashboard Health
```bash
# Check dashboard loads
curl $WORKER_URL/dashboard

# Check API stats endpoint
curl $WORKER_URL/dashboard/api/stats | jq '.signals.total'

# Should show actual count, not 0
```

## Troubleshooting

### Dashboard Still Shows Empty Stats

**Check:**
```bash
# Verify signals exist in database
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT COUNT(*) as count FROM signals"

# Should return count > 0
```

**If count is 0:**
```bash
# Manually trigger collection
curl -X POST $WORKER_URL/collect

# Wait for completion
sleep 30

# Check again
curl $WORKER_URL/dashboard/api/stats
```

### APIs Still Failing

**Check which ones:**
```bash
# Get collection status
curl $WORKER_URL/collection-status | jq '.results'

# Look for failed sources
jq '.results[] | select(.success == false)'
```

**Expected failures:**
- Binance: Should not be in list (replaced with Kraken)
- CoinCap: Should not be in list (replaced with Messari)
- CryptoCompare: May fail 30-40% of time (known issue)
- Messari: May fail 40-50% of time (rate limits)

**Acceptable success rate: 60-70%**

### Cron Not Running

**Check cron configuration:**
```bash
# View cron schedule
cat wrangler.toml | grep -A 2 "\[triggers\]"

# Should show:
# [triggers]
# crons = ["*/15 * * * *"]
```

**Verify cron executions:**
```bash
# Check logs for scheduled runs
wrangler tail | grep "scheduled FREE data collection V2"
```

## Performance Optimization

### Reduce Failed API Calls

**Disable problematic sources:**

Edit `src/index-free-v2.js`:

```javascript
// Comment out unreliable sources
const sources = [
  { name: 'CoinGecko', fn: fetchCoinGeckoFree },           // Keep
  { name: 'DeFi Llama', fn: fetchDeFiLlamaFree },          // Keep
  { name: 'Kraken', fn: fetchKrakenFree },                 // Keep
  { name: 'Alternative.me', fn: fetchFearGreedIndex },     // Keep
  // { name: 'Messari', fn: fetchMessariFree },            // Disable if failing
  // { name: 'CryptoCompare', fn: fetchCryptoCompareFree } // Disable if failing
];
```

### Adjust Cron Frequency

If hitting rate limits:

```toml
# Change from every 15 minutes to every 30 minutes
[triggers]
crons = ["*/30 * * * *"]

# Or every hour
crons = ["0 * * * *"]
```

### Increase Cache TTL

For more stable data:

```javascript
// Increase cache from 5 minutes to 15 minutes
await env.CRYPTOINTEL_CACHE.put(
  `market_data:${symbol}`,
  JSON.stringify(result),
  { expirationTtl: 900 }  // 15 minutes instead of 300
);
```

## Success Metrics

After 24 hours of V2 deployment, you should see:

| Metric | Target | Notes |
|--------|--------|-------|
| Dashboard Stats Working | ✅ Yes | Shows actual counts |
| Success Rate | 60-70% | Honest, not fake |
| Signals Generated | 5-15/run | Realistic |
| Market Data Points | 30-50/run | From working sources |
| API Errors | 30-40% | Expected with free APIs |
| Cron Executions | 96/day | Every 15 minutes |
| Cache Hit Rate | 60-80% | Good caching |

## Next Steps

After successful V2 deployment:

1. **Monitor for 24-48 hours**
   - Watch logs
   - Check success rates
   - Verify dashboard stats

2. **Tune Configuration**
   - Adjust cron frequency
   - Tweak cache TTLs
   - Disable failing sources

3. **Consider Upgrades**
   - CoinGecko Pro ($129/month) for better reliability
   - Workers AI ($5/month) for entity extraction
   - Additional paid sources if needed

4. **Document Actual Performance**
   - Track real success rates
   - Note which APIs work best
   - Update documentation

## Support

If you encounter issues:

1. Check `HONEST_TESTING_RESULTS.md` for known issues
2. Review logs with `wrangler tail`
3. Test locally with `npm run dev`
4. Verify database with `wrangler d1 execute`
5. Check Cloudflare dashboard for errors

---

*Version: 2.2.0-free-v2-honest*
*Last Updated: 2025-12-01*
