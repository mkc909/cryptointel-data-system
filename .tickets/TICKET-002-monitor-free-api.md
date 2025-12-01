# TICKET-002: Monitor FREE API Performance and Data Quality

**Status:** Not Started
**Priority:** CRITICAL
**Estimated Time:** Ongoing (15-30 min/day)
**Assigned To:** [Unassigned]
**Created:** 2025-12-01
**Due Date:** Ongoing

---

## Objectives

Continuously monitor the production FREE API deployment to ensure stability, performance, and data quality. This is critical for maintaining service reliability and identifying issues before they impact users.

---

## Success Criteria

- [ ] Daily monitoring routine established (15-30 minutes)
- [ ] Cron jobs executing successfully (96+ per day at 15-min intervals)
- [ ] API response times under 500ms (p95)
- [ ] Data collection success rate above 95%
- [ ] Zero critical errors in production
- [ ] Resource utilization within limits (D1, KV, CPU)
- [ ] Automated alerts configured for anomalies

---

## Dependencies

**Requires:**
- Production deployment completed (COMPLETED via deploy-free.bat)
- Access to Cloudflare dashboard
- Wrangler CLI configured
- Access to deployed URLs

**Enables:**
- Data quality validation for downstream consumers
- Early detection of API source changes
- Performance baseline establishment

---

## Implementation Steps

### Phase 1: Setup Monitoring Tools (Day 1 - 2 hours)

1. **Install monitoring scripts**
   ```bash
   cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

   # Verify monitoring scripts exist
   dir monitor-deployment.bat
   dir validate-deployment.bat
   ```

2. **Configure Cloudflare dashboard access**
   - Bookmark: https://dash.cloudflare.com/
   - Save Worker URL: https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev
   - Enable Analytics in Cloudflare dashboard

3. **Setup Wrangler CLI for logs**
   ```bash
   # Test wrangler authentication
   wrangler whoami

   # Test log streaming
   wrangler tail cryptointel-data-free --format json
   ```

4. **Create monitoring checklist file**
   ```bash
   # Create daily monitoring log
   echo "Date,Cron_Success,API_Response_Time,Error_Count,Data_Quality_Score,Notes" > monitoring-log.csv
   ```

### Phase 2: Daily Monitoring Routine (15-30 min/day)

5. **Morning Check (10 minutes)**

   **A. Check cron job execution**
   ```bash
   # View last 24 hours of cron executions
   wrangler d1 execute CRYPTOINTEL_DB_FREE --command "SELECT timestamp, status, signals_detected FROM api_usage WHERE endpoint = 'scheduled' ORDER BY timestamp DESC LIMIT 96"

   # Expected: 96 entries (4 per hour x 24 hours)
   # All status should be 'success' or 'partial_success'
   ```

   **B. Check API health**
   ```bash
   # Health check
   curl https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/health

   # Expected response:
   # {
   #   "status": "healthy",
   #   "version": "1.0.0-free",
   #   "timestamp": "...",
   #   "sources": {...}
   # }
   ```

   **C. Check recent signals**
   ```bash
   # Get signals from last hour
   curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/signals?limit=20" | python -m json.tool

   # Verify:
   # - Signals are recent (within last hour)
   # - Signal types are valid (sentiment_shift, tvl_anomaly, volume_anomaly)
   # - Confidence scores are reasonable (0.5-1.0)
   ```

6. **Afternoon Check (5 minutes)**

   **A. Review Cloudflare Analytics**
   - Go to Cloudflare Dashboard > Workers & Pages > cryptointel-data-free
   - Check:
     - Request count (should show consistent traffic)
     - Error rate (should be <1%)
     - CPU time (should be under 50ms average)
     - Duration (should be under 200ms p95)

   **B. Spot check data sources**
   ```bash
   # Test each data source endpoint
   curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/market-data/bitcoin"
   curl "https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/market-data/ethereum"

   # Verify data is current and complete
   ```

7. **Evening Check (5 minutes - optional)**

   **A. Review error logs**
   ```bash
   # Stream logs for 2 minutes and look for errors
   wrangler tail cryptointel-data-free --format pretty

   # Look for:
   # - Rate limit errors (429)
   # - API failures (500, 502, 503)
   # - Database errors
   # - Timeout issues
   ```

### Phase 3: Weekly Deep Dive (1 hour/week)

8. **Data Quality Analysis**
   ```bash
   # Check signal statistics
   wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
   SELECT
     signal_type,
     COUNT(*) as count,
     AVG(confidence_score) as avg_confidence,
     MIN(timestamp) as oldest,
     MAX(timestamp) as newest
   FROM signals
   WHERE timestamp > strftime('%s', 'now', '-7 days')
   GROUP BY signal_type
   ORDER BY count DESC
   "

   # Expected patterns:
   # - sentiment_shift: 50-200 per day
   # - tvl_anomaly: 10-50 per day
   # - volume_anomaly: 20-100 per day
   ```

9. **Entity Extraction Analysis**
   ```bash
   # Check entity detection
   wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
   SELECT
     entity_name,
     entity_type,
     COUNT(*) as mentions,
     AVG(sentiment_score) as avg_sentiment
   FROM entity_mentions
   WHERE timestamp > strftime('%s', 'now', '-7 days')
   GROUP BY entity_name, entity_type
   ORDER BY mentions DESC
   LIMIT 20
   "

   # Verify major tokens are being detected (Bitcoin, Ethereum, etc.)
   ```

10. **Performance Analysis**
    ```bash
    # Check API performance
    wrangler d1 execute CRYPTOINTEL_DB_FREE --command "
    SELECT
      endpoint,
      COUNT(*) as request_count,
      AVG(response_time) as avg_response_time,
      MAX(response_time) as max_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
    FROM api_usage
    WHERE timestamp > strftime('%s', 'now', '-7 days')
    GROUP BY endpoint
    ORDER BY request_count DESC
    "

    # Target metrics:
    # - avg_response_time: <500ms
    # - max_response_time: <2000ms
    # - error_rate: <1%
    ```

### Phase 4: Resource Utilization Monitoring

11. **D1 Database Size**
    ```bash
    # Check database size (through Cloudflare dashboard)
    # Navigate to: Storage & Databases > D1 > CRYPTOINTEL_DB_FREE
    # Monitor: Rows stored, Database size

    # Free tier limits:
    # - 5 GB storage
    # - 5 million rows
    ```

12. **KV Storage Monitoring**
    ```bash
    # List cache keys
    wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID --prefix="market_data:"

    # Check cache hit rates in application logs
    # Target: >80% cache hit rate
    ```

13. **Worker CPU Time**
    ```bash
    # Check in Cloudflare dashboard
    # Workers & Pages > cryptointel-data-free > Metrics
    # Monitor: CPU time per request

    # Free tier limit: 10ms average
    # Target: <5ms average
    ```

### Phase 5: Automated Alerts Setup (30 minutes)

14. **Configure Cloudflare Alerts**
    - Go to Cloudflare Dashboard > Notifications
    - Create alerts for:
      - Worker error rate >5%
      - Worker CPU time >10ms average
      - D1 storage >4GB (80% of limit)
      - KV operations approaching limits

15. **Setup monitoring script** (optional)
    Create `scripts/monitor-health.js`:
    ```javascript
    // Health monitoring script
    // Run daily via cron or Task Scheduler
    // Sends alerts if metrics exceed thresholds
    ```

---

## Testing Requirements

### Daily Tests
- [ ] Health endpoint returns 200 OK
- [ ] Cron jobs executed in last hour
- [ ] Recent signals exist in database
- [ ] All data sources returning data
- [ ] No critical errors in logs

### Weekly Tests
- [ ] Data quality metrics within acceptable ranges
- [ ] Performance metrics meeting SLAs
- [ ] Resource utilization under limits
- [ ] Cache hit rates above 80%

---

## Key Metrics to Track

### Performance Metrics
- **API Response Time:** <500ms (p95), <200ms (p50)
- **Cron Execution Success Rate:** >98%
- **Data Collection Success Rate:** >95%
- **Cache Hit Rate:** >80%
- **Error Rate:** <1%

### Data Quality Metrics
- **Signals Per Day:** 100-400 (varies by market activity)
- **Entities Detected Per Day:** 50-200 unique entities
- **Average Confidence Score:** >0.6
- **Data Freshness:** <30 minutes for all sources

### Resource Utilization
- **D1 Database Size:** <4GB (80% of 5GB limit)
- **D1 Row Count:** <4 million (80% of 5M limit)
- **KV Operations:** <90k per day (90% of 100k limit)
- **Worker CPU Time:** <5ms average

---

## Alert Thresholds

### Critical Alerts (Immediate Action Required)
- Cron job failed for 2+ consecutive runs
- Error rate >10%
- D1 database >90% full
- All data sources failing

### Warning Alerts (Review Within 24 Hours)
- Error rate 5-10%
- Response time >1000ms (p95)
- Data collection success rate <90%
- D1 database >80% full

### Info Alerts (Review Weekly)
- Cache hit rate <70%
- Response time 500-1000ms (p95)
- New signal patterns detected
- Resource utilization trends

---

## Documentation Needs

- [ ] Create `MONITORING_GUIDE.md` with detailed procedures
- [ ] Document alert response procedures
- [ ] Create troubleshooting runbook
- [ ] Maintain monitoring log CSV file
- [ ] Weekly summary reports

---

## Related Issues/Tickets

**Related To:**
- TICKET-008: Establish Performance Baselines
- TICKET-016: Daily Monitoring Checklist
- TICKET-017: Weekly Performance Reporting

**Blocks:**
- All production features and enhancements
- Performance optimization work

---

## Monitoring Checklist Template

```markdown
## Daily Monitoring - [DATE]

### Morning Check (10 min)
- [ ] Cron jobs executed: ___/96 in last 24h
- [ ] Health endpoint: ✅ OK / ❌ FAIL
- [ ] Recent signals: ✅ Present / ❌ Missing
- [ ] Error rate: ___%

### Afternoon Check (5 min)
- [ ] Cloudflare Analytics reviewed
- [ ] Request count: _____
- [ ] CPU time: ___ms avg
- [ ] Duration: ___ms p95

### Issues Found
- None / [List issues]

### Actions Taken
- None / [List actions]

### Notes
- [Any observations or concerns]
```

---

## Escalation Procedures

### Level 1: Minor Issues (Self-resolve)
- Single cron failure
- Temporary API timeouts
- Cache misses

**Action:** Monitor next execution, document in log

### Level 2: Moderate Issues (Review within 24h)
- Multiple cron failures
- Sustained high error rate (5-10%)
- Data source deprecated/changed

**Action:** Investigate root cause, implement fix, test thoroughly

### Level 3: Critical Issues (Immediate action)
- Complete service outage
- Data corruption
- Security vulnerability
- Resource limit exceeded

**Action:**
1. Assess impact
2. Implement immediate fix or rollback
3. Notify stakeholders
4. Document incident
5. Schedule post-mortem

---

## Tools and Resources

### Essential URLs
- Production Worker: https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev
- Cloudflare Dashboard: https://dash.cloudflare.com/
- D1 Database: Cloudflare Dashboard > Storage & Databases > D1
- KV Namespace: Cloudflare Dashboard > Storage & Databases > KV

### CLI Commands Reference
```bash
# Health check
curl https://cryptointel-data-free.YOUR_SUBDOMAIN.workers.dev/health

# View logs
wrangler tail cryptointel-data-free

# Query D1
wrangler d1 execute CRYPTOINTEL_DB_FREE --command "SELECT ..."

# List KV keys
wrangler kv:key list --namespace-id=YOUR_KV_ID

# Run validation script
.\validate-deployment.bat
```

---

## Notes

- Set daily reminder at 9 AM for morning check
- Set weekly reminder at Friday 2 PM for deep dive
- Keep monitoring log updated for trend analysis
- Share weekly summary with stakeholders
- Adjust thresholds based on baseline data

---

**Last Updated:** 2025-12-01
**Next Review:** Daily
