# TICKET-016: Daily Monitoring Checklist

**Status:** Ongoing
**Priority:** HIGH
**Estimated Time:** 15-30 min/day
**Assigned To:** [Unassigned]
**Created:** 2025-12-01

---

## Objectives

Establish and maintain daily operational monitoring routine to ensure system health, catch issues early, and maintain high service quality.

---

## Success Criteria

- [ ] Daily checklist completed 90%+ of days
- [ ] Issues detected within 24 hours
- [ ] Average issue resolution time <48 hours
- [ ] Zero undetected critical issues
- [ ] Monitoring log maintained consistently

---

## Daily Checklist (15-30 minutes)

### Morning Check (10 min) - 9:00 AM

**1. Cron Job Health**
```bash
# Check last 24 hours of cron executions
wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
SELECT
  COUNT(*) as executions,
  SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successful,
  MIN(timestamp) as first_run,
  MAX(timestamp) as last_run
FROM api_usage
WHERE endpoint = 'scheduled'
  AND timestamp > strftime('%s', 'now', '-24 hours')
"

# ✅ Expected: 96 executions, >95 successful
# ❌ Alert if: <90 executions or <90% success rate
```

**2. API Health Check**
```bash
# Test health endpoint
curl https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/health

# ✅ Expected: {"status":"healthy","version":"1.0.0-free"}
# ❌ Alert if: Error or "status":"unhealthy"
```

**3. Recent Signals Check**
```bash
# Verify signals from last hour
curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/signals?limit=10" | python -m json.tool

# ✅ Expected: 5-20 signals from last hour
# ❌ Alert if: Zero signals or all older than 1 hour
```

**4. Error Rate Check**
```bash
# Check errors in last 24 hours
wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
SELECT
  status_code,
  COUNT(*) as count
FROM api_usage
WHERE timestamp > strftime('%s', 'now', '-24 hours')
  AND status_code >= 400
GROUP BY status_code
ORDER BY count DESC
"

# ✅ Expected: <1% error rate
# ❌ Alert if: >5% errors or any 500 errors
```

### Afternoon Check (5 min) - 2:00 PM

**5. Cloudflare Analytics Review**
- Navigate to: Cloudflare Dashboard > Workers & Pages > cryptointel-data-free
- Review past 6 hours:
  - **Request count:** Should show consistent traffic
  - **Error rate:** <1% target
  - **CPU time:** <10ms average
  - **Duration:** <200ms p95

**6. Data Source Validation**
```bash
# Test each source has recent data
curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/market-data/bitcoin"
curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/market-data/ethereum"

# ✅ Expected: Current price, volume, market_cap
# ❌ Alert if: Null data or >30 minutes old
```

### Evening Review (5 min) - 6:00 PM (Optional)

**7. Day Summary**
```bash
# Generate daily summary
wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
SELECT
  'Total Signals' as metric, COUNT(*) as value
FROM signals
WHERE timestamp > strftime('%s', 'now', '-24 hours')
UNION ALL
SELECT
  'Unique Entities', COUNT(DISTINCT entity_name)
FROM entity_mentions
WHERE timestamp > strftime('%s', 'now', '-24 hours')
UNION ALL
SELECT
  'API Requests', COUNT(*)
FROM api_usage
WHERE timestamp > strftime('%s', 'now', '-24 hours')
"
```

---

## Weekly Deep Dive (Friday, 30 min)

### Data Quality Analysis
```sql
-- Signal distribution by type
SELECT
  signal_type,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence,
  COUNT(DISTINCT source) as sources
FROM signals
WHERE timestamp > strftime('%s', 'now', '-7 days')
GROUP BY signal_type
ORDER BY count DESC
```

### Performance Metrics
```sql
-- API performance summary
SELECT
  endpoint,
  COUNT(*) as requests,
  AVG(response_time) as avg_ms,
  MAX(response_time) as max_ms,
  CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as error_rate
FROM api_usage
WHERE timestamp > strftime('%s', 'now', '-7 days')
GROUP BY endpoint
ORDER BY requests DESC
LIMIT 10
```

### Resource Utilization
- Check D1 database size (target: <80% of 5GB)
- Check KV operations (target: <90% of 100k/day)
- Review CPU time trends

---

## Monitoring Log Template

Create file: `monitoring-logs/2025-12-[DD].md`

```markdown
# Daily Monitoring - 2025-12-01

## Morning Check (9:00 AM)
- [x] Cron jobs: 96/96 successful ✅
- [x] Health check: OK ✅
- [x] Recent signals: 15 signals in last hour ✅
- [x] Error rate: 0.5% ✅

## Afternoon Check (2:00 PM)
- [x] Cloudflare analytics: Normal ✅
- [x] Data sources: All responding ✅

## Issues Found
- None

## Actions Taken
- None required

## Notes
- Signal volume higher than usual (market volatility)
- All metrics within acceptable ranges
```

---

## Alert Thresholds

### Critical (Immediate Action)
- ❌ Health endpoint down
- ❌ Zero signals for 2+ hours
- ❌ Cron job failure for 2+ consecutive runs
- ❌ Error rate >10%
- ❌ All data sources failing

### Warning (Review within 4 hours)
- ⚠️ Error rate 5-10%
- ⚠️ Cron success rate <95%
- ⚠️ Response time >1000ms p95
- ⚠️ Data source failures (any single source)
- ⚠️ Signal volume anomaly (>2x or <0.5x normal)

### Info (Review within 24 hours)
- ℹ️ Cache hit rate <70%
- ℹ️ Response time 500-1000ms p95
- ℹ️ Minor error rate increase (2-5%)
- ℹ️ Resource utilization trends upward

---

## Automated Scripts

### Quick Health Check Script
File: `scripts/quick-health-check.sh`

```bash
#!/bin/bash
# Quick health check - run daily

WORKER_URL="https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev"

echo "=== Daily Health Check ==="
echo "Date: $(date)"
echo ""

# Health endpoint
echo "1. Health Check:"
curl -s "$WORKER_URL/health" | jq '.status'

# Recent signals
echo ""
echo "2. Recent Signals:"
curl -s "$WORKER_URL/signals?limit=5" | jq 'length'

# Market data
echo ""
echo "3. Market Data:"
curl -s "$WORKER_URL/market-data/bitcoin" | jq '.price'

echo ""
echo "=== Check Complete ==="
```

### Windows Batch Version
File: `scripts/quick-health-check.bat`

```batch
@echo off
echo === Daily Health Check ===
echo Date: %date% %time%
echo.

set WORKER_URL=https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev

echo 1. Health Check:
curl -s "%WORKER_URL%/health"
echo.

echo 2. Recent Signals:
curl -s "%WORKER_URL%/signals?limit=5"
echo.

echo 3. Market Data:
curl -s "%WORKER_URL%/market-data/bitcoin"
echo.

echo === Check Complete ===
pause
```

---

## Integration with Monitoring Tools

### Slack/Discord Notifications (Optional)
```bash
# Send daily summary to Slack
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Daily CryptoIntel Summary",
    "attachments": [{
      "color": "good",
      "fields": [
        {"title": "Health", "value": "✅ OK", "short": true},
        {"title": "Signals", "value": "127 today", "short": true},
        {"title": "Error Rate", "value": "0.3%", "short": true},
        {"title": "Uptime", "value": "100%", "short": true}
      ]
    }]
  }'
```

---

## Escalation Procedures

### Critical Issues
1. Stop and assess impact
2. Check error logs immediately
3. Implement emergency fix or rollback
4. Notify stakeholders
5. Document in incident log
6. Schedule post-mortem

### Warning Issues
1. Document in monitoring log
2. Investigate root cause
3. Create ticket if fix needed
4. Monitor for 24 hours
5. Implement fix if issue persists

### Info Issues
1. Add to weekly review notes
2. Track trend over time
3. Create ticket if pattern emerges

---

## Related Issues/Tickets

**Related To:**
- TICKET-002: Monitor FREE API
- TICKET-017: Weekly Performance Reporting
- TICKET-019: Security Audits

---

## Tools Needed

- [ ] Wrangler CLI installed and authenticated
- [ ] curl or equivalent HTTP client
- [ ] jq for JSON parsing (optional)
- [ ] Text editor for monitoring logs
- [ ] Cloudflare Dashboard access
- [ ] Calendar reminder for daily checks

---

## Best Practices

1. **Consistency:** Check at same time daily
2. **Documentation:** Always log findings
3. **Proactive:** Don't wait for users to report issues
4. **Trending:** Track metrics over time, not just point-in-time
5. **Automation:** Script repetitive checks
6. **Communication:** Share weekly summaries with team

---

## Monthly Review

Last Friday of each month (1 hour):
- Review all daily logs for patterns
- Update alert thresholds if needed
- Identify process improvements
- Update monitoring checklist
- Plan optimization work

---

**Last Updated:** 2025-12-01
**Next Review:** Daily
