# TICKET-005: Plan WebSocket Architecture

**Status:** Not Started
**Priority:** HIGH
**Estimated Time:** 1 week
**Assigned To:** [Unassigned]
**Created:** 2025-12-01
**Due Date:** 2025-12-08

---

## Objectives

Design and plan WebSocket architecture for real-time data streaming using Cloudflare Durable Objects to enable live signal updates, reducing client polling and improving user experience.

---

## Success Criteria

- [ ] Technical specification document created
- [ ] Architecture diagram completed
- [ ] Durable Objects design finalized
- [ ] WebSocket protocol defined
- [ ] Connection management strategy documented
- [ ] Load testing plan prepared
- [ ] Cost estimation completed
- [ ] Implementation plan ready for TICKET-006

---

## Dependencies

**Requires:**
- Understanding of Cloudflare Durable Objects
- Current API usage patterns analyzed
- Client requirements gathered

**Blocks:**
- TICKET-006: WebSocket Implementation
- TICKET-009: Mobile App (needs real-time updates)

---

## Implementation Steps

### Phase 1: Requirements Gathering (2 days)

1. **Identify Use Cases**
   - Real-time signal notifications
   - Live market data updates
   - Dashboard live refresh
   - Mobile app push notifications
   - Multi-user collaboration (future)

2. **Analyze Current API Usage**
   ```sql
   -- Polling frequency analysis
   SELECT
     endpoint,
     COUNT(*) as requests,
     COUNT(DISTINCT user_id) as unique_users
   FROM api_usage
   WHERE timestamp > strftime('%s', 'now', '-24 hours')
     AND endpoint IN ('/signals', '/market-data/*')
   GROUP BY endpoint
   ```

3. **Define Client Requirements**
   - Connection persistence time
   - Message frequency expectations
   - Subscription management needs
   - Authentication requirements
   - Reconnection handling

### Phase 2: Architecture Design (3 days)

4. **Design Durable Objects Structure**
   ```
   ConnectionManager (Durable Object)
     ├─ Manages WebSocket connections
     ├─ Routes messages to subscribers
     ├─ Handles connection lifecycle
     └─ Maintains subscription state

   SignalBroadcaster (Durable Object)
     ├─ Receives new signals from cron
     ├─ Broadcasts to all subscribers
     ├─ Filters by subscription topics
     └─ Manages message queues

   UserSession (Durable Object - optional)
     ├─ Per-user connection state
     ├─ Watchlist subscriptions
     ├─ Notification preferences
     └─ Activity tracking
   ```

5. **Define WebSocket Protocol**
   ```json
   {
     "message_types": {
       "subscribe": {
         "topics": ["signals", "market_data", "specific_entity"],
         "filters": {"signal_type": "sentiment_shift"}
       },
       "unsubscribe": {
         "topics": ["signals"]
       },
       "signal_update": {
         "signal": {...},
         "timestamp": "2025-12-01T10:00:00Z"
       },
       "heartbeat": {
         "interval": 30000
       }
     }
   }
   ```

6. **Design Connection Flow**
   ```
   Client                Worker              Durable Object
     |                     |                      |
     |--WebSocket Open---->|                      |
     |                     |--Get/Create DO------>|
     |                     |<--DO Instance--------|
     |<--Connection OK-----|                      |
     |                     |                      |
     |--Subscribe Msg----->|--Forward------------>|
     |<--Subscribed OK-----|<--Confirmed----------|
     |                     |                      |
     |                     |<--New Signal---------|
     |<--Signal Update-----|                      |
   ```

### Phase 3: Scalability Planning (2 days)

7. **Estimate Load Requirements**
   - Expected concurrent connections: 100-1000 initially
   - Messages per second: 10-100
   - Average connection duration: 5-60 minutes
   - Peak concurrent users: 2x average

8. **Plan Durable Objects Distribution**
   - One ConnectionManager per N connections (N=100-500)
   - Geographic distribution for low latency
   - Load balancing strategy

9. **Design Message Broadcasting**
   ```javascript
   // Broadcast strategy
   class SignalBroadcaster {
     async broadcast(signal) {
       // Fan-out to all ConnectionManager DOs
       const managers = await this.getActiveManagers();
       await Promise.all(
         managers.map(m => m.routeSignal(signal))
       );
     }
   }
   ```

### Phase 4: Data Flow Design (1 day)

10. **Integrate with Existing Cron**
    ```javascript
    // In scheduled() handler
    export async function scheduled(event, env) {
      // ... existing data collection ...

      // Broadcast new signals via WebSocket
      if (newSignals.length > 0) {
        const broadcaster = env.SIGNAL_BROADCASTER.get(
          env.SIGNAL_BROADCASTER.idFromName('global')
        );
        await broadcaster.broadcast(newSignals);
      }
    }
    ```

11. **Define Subscription Model**
    ```javascript
    // Subscription topics
    const TOPICS = {
      ALL_SIGNALS: 'signals:*',
      SIGNAL_TYPE: 'signals:type:{type}',
      ENTITY: 'signals:entity:{name}',
      MARKET_DATA: 'market:{symbol}',
      CUSTOM_WATCHLIST: 'watchlist:{user_id}'
    };
    ```

### Phase 5: Security and Authentication (1 day)

12. **Design Authentication**
    - API key in WebSocket URL: `wss://...?apiKey=xxx`
    - JWT token in initial message
    - Rate limiting per connection
    - Connection timeout policies

13. **Define Security Measures**
    - Message validation
    - DOS protection
    - Connection limits per user
    - Abuse detection

### Phase 6: Monitoring and Observability (1 day)

14. **Plan Metrics Collection**
    ```javascript
    // Metrics to track
    const METRICS = {
      activeConnections: 'gauge',
      messagesPerSecond: 'counter',
      messageLatency: 'histogram',
      connectionErrors: 'counter',
      subscriptionChanges: 'counter'
    };
    ```

15. **Design Health Monitoring**
    - Durable Object health checks
    - Connection manager status
    - Message queue depth
    - Error rate tracking

### Phase 7: Cost Estimation (1 day)

16. **Calculate Cloudflare Costs**
    ```
    Durable Objects Pricing:
    - $0.15 per million requests
    - $12.50 per million GB-seconds of compute

    Estimates (1000 concurrent users):
    - Requests: ~10M/month = $1.50
    - Compute: ~100 GB-seconds/month = $1.25
    - Total: ~$3/month

    FREE tier limits:
    - 1M requests/month
    - 400k GB-seconds/month
    ```

17. **Compare to Polling Costs**
    - Current polling: High request count, high cache usage
    - WebSocket: Lower requests, persistent connections
    - Expected savings: 80% reduction in API calls

---

## Deliverables

### Documents to Create
- [ ] `docs/WEBSOCKET_ARCHITECTURE.md` - Full architecture specification
- [ ] `docs/WEBSOCKET_PROTOCOL.md` - Protocol and message format
- [ ] `docs/DURABLE_OBJECTS_DESIGN.md` - DO implementation details
- [ ] Architecture diagrams (use Mermaid or draw.io)
- [ ] Load testing plan
- [ ] Cost analysis spreadsheet

### Architecture Diagrams Needed
- [ ] System architecture overview
- [ ] Connection flow diagram
- [ ] Message routing diagram
- [ ] Durable Objects relationships
- [ ] Geographic distribution map

---

## Key Decisions to Make

### Technical Decisions
- [ ] Number of Durable Objects (1 global vs N distributed)
- [ ] Message format (JSON vs Protocol Buffers vs MessagePack)
- [ ] Reconnection strategy (client vs server initiated)
- [ ] State management (in-memory vs D1 persistence)
- [ ] Authentication method (API key vs JWT vs OAuth)

### Operational Decisions
- [ ] Deployment strategy (phased rollout vs all-at-once)
- [ ] Monitoring tools (Cloudflare Analytics vs custom)
- [ ] Alert thresholds
- [ ] Support for legacy polling clients
- [ ] Migration timeline

---

## Testing Requirements

### Load Testing Plan
- [ ] Simulate 100 concurrent connections
- [ ] Simulate 1000 concurrent connections
- [ ] Test message throughput (100/sec, 1000/sec)
- [ ] Test connection stability (30 min, 1 hour)
- [ ] Test reconnection scenarios
- [ ] Test geographic latency

### Functional Testing Plan
- [ ] Subscribe/unsubscribe flows
- [ ] Message delivery accuracy
- [ ] Message ordering guarantees
- [ ] Error handling
- [ ] Authentication flows

---

## Documentation Needs

- [ ] Technical specification document
- [ ] API documentation for WebSocket endpoints
- [ ] Client integration guide
- [ ] Troubleshooting guide
- [ ] Migration guide for polling clients

---

## Related Issues/Tickets

**Related To:**
- TICKET-006: WebSocket Implementation (next step)
- TICKET-007: Mobile App Planning (consumer of WebSocket)
- TICKET-009: Mobile App Development (will use WebSocket)

---

## Research Resources

### Cloudflare Documentation
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- WebSockets: https://developers.cloudflare.com/workers/runtime-apis/websockets/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/

### Examples
- Cloudflare WebSocket chat example
- Durable Objects counter example
- Real-time collaborative editing examples

---

## Risk Assessment

### High Risks
- **Complexity:** Durable Objects are complex, steep learning curve
- **Cost:** Unexpected cost spikes if usage exceeds estimates
- **Performance:** Latency issues with geographic distribution

**Mitigation:**
- Prototype with simple example first
- Implement cost monitoring and alerts
- Use Cloudflare's global network effectively

### Medium Risks
- **Client compatibility:** WebSocket support varies
- **Connection stability:** Mobile networks can be unstable
- **State management:** Ensuring consistency across DOs

**Mitigation:**
- Provide fallback to polling
- Implement robust reconnection logic
- Use D1 for critical state persistence

---

## Success Metrics for Planning Phase

- [ ] Architecture reviewed by 2+ team members
- [ ] All key decisions documented
- [ ] Cost estimates validated
- [ ] Load testing plan approved
- [ ] Implementation timeline agreed
- [ ] Zero blockers for TICKET-006

---

## Notes

- Keep architecture simple initially, iterate based on usage
- Consider using existing WebSocket libraries/frameworks
- Plan for backward compatibility with polling
- Document all assumptions clearly
- Review Cloudflare examples thoroughly before finalizing design

---

**Last Updated:** 2025-12-01
**Next Review:** End of planning week
