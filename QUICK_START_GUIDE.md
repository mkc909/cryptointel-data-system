# CryptoIntel Data System - Quick Start Guide for Developers

**For**: New developers joining the project
**Goal**: Get up and running in <1 hour

---

## 5-Minute Setup

### Prerequisites Check
```bash
node --version    # Must be 18+ or 20+
npm --version     # Must be 8+
git --version     # Any recent version
```

If missing, install from:
- Node.js: https://nodejs.org/ (LTS)
- Git: https://git-scm.com/

### Installation
```bash
# 1. Clone and navigate
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

# 2. Install dependencies
npm install

# 3. Install wrangler globally
npm install -g wrangler

# 4. Setup environment
wrangler login  # Login to Cloudflare

# 5. Setup secrets (get keys from team lead)
wrangler secret put COINGECKO_API_KEY
wrangler secret put COINMARKETCAP_API_KEY

# 6. Apply database schema
npm run db:migrate

# 7. Start development server
npm run dev
```

Visit http://localhost:8787/health to verify setup.

---

## Work Stream Assignment

### Which stream are you on?

#### Backend Developer?
**Your focus**: APIs, data collection, signal detection
**Start here**:
1. Read API contracts in `PROJECT_PLAN_PARALLEL_DEVELOPMENT.md` (Section: API Contract Documentation)
2. Review `src/index.js` to understand current implementation
3. Check your assigned tickets in `.tickets/active/`
4. Start with Phase 1 backend tasks

**Key files**:
- `src/index.js` - Main application
- `schema.sql` - Database schema
- `test/index.test.js` - Unit tests

#### Frontend Developer?
**Your focus**: Dashboard, UI/UX, visualization
**Start here**:
1. Read API contracts (same section as backend)
2. Review `src/dashboard.js` for current UI
3. Setup mock API server for local development
4. Start with Phase 1 frontend tasks

**Key files**:
- `src/dashboard.js` - Main dashboard
- `src/intelligence-dashboard.js` - Advanced analytics
- HTML templates in dashboard.js

#### Infrastructure/DevOps?
**Your focus**: Deployment, monitoring, performance
**Start here**:
1. Review `wrangler.toml` configuration
2. Check CI/CD pipeline (if exists)
3. Setup monitoring dashboards
4. Start with Phase 1 infrastructure tasks

**Key files**:
- `wrangler.toml` - Cloudflare config
- `package.json` - Scripts and dependencies
- `.github/workflows/` - CI/CD (if exists)

---

## Your First Contribution

### Day 1: Orientation
- [ ] Complete 5-minute setup above
- [ ] Read `CLAUDE.md` - Project overview
- [ ] Read API contracts in `PROJECT_PLAN_PARALLEL_DEVELOPMENT.md`
- [ ] Review your assigned phase in the project plan
- [ ] Join team communication channel
- [ ] Get API keys from team lead

### Day 2-3: First Task
- [ ] Pick your first ticket from `.tickets/active/`
- [ ] Create feature branch: `git checkout -b feature/YOUR-TASK`
- [ ] Implement according to API contract
- [ ] Write unit tests (target 80% coverage)
- [ ] Test locally: `npm run dev` and `npm test`
- [ ] Create pull request

### Day 4-5: Integration
- [ ] Code review with team
- [ ] Address feedback
- [ ] Merge to main branch
- [ ] Deploy to staging: `npm run deploy:staging`
- [ ] Verify functionality

---

## Common Tasks Reference

### Development Workflow
```bash
# Start local server
npm run dev          # Port 8787

# Run tests
npm test             # Unit tests
npm run test:coverage # With coverage report

# Code quality
npm run lint         # Check for issues
npm run lint:fix     # Auto-fix issues
npm run format       # Prettier formatting
```

### Database Operations
```bash
# Apply schema changes
npm run db:migrate

# Query database
wrangler d1 execute CRYPTOINTEL_DB --command "SELECT * FROM signals LIMIT 10"

# Backup database
npm run db:backup
```

### Deployment
```bash
# Deploy to staging (test first!)
npm run deploy:staging

# Deploy to production (after testing)
npm run deploy

# View logs
npm run logs

# View metrics
npm run metrics
```

### Testing
```bash
# Run all tests
npm run test:all

# Run specific test file
npm test test/index.test.js

# Run integration tests
npm run test:integration
```

---

## API Contract Cheat Sheet

### Backend Developers: What You Need to Implement

#### Core Endpoints
```javascript
GET  /health                      // System health check
GET  /market-data/:symbol         // Get market data for symbol
GET  /signals                     // Get signals with filtering
GET  /market-analysis             // Multi-symbol analysis
POST /collect                     // Trigger data collection

// DEX Endpoints
GET  /dex/pairs                   // DEX trading pairs
GET  /dex/networks                // Blockchain networks
GET  /dex/signals                 // DEX-specific signals
GET  /dex/analysis/:pair_id       // Comprehensive pair analysis
GET  /dex/volume-leaders          // Top volume pairs

// x402 Payment
POST /x402/analysis               // Paid analysis endpoint
GET  /x402/transactions           // Transaction history
GET  /x402/analytics              // Revenue analytics

// Dashboard APIs
GET  /dashboard/api/stats         // Dashboard statistics
GET  /dashboard/api/signals       // Real-time signals
GET  /dashboard/api/transactions  // Transaction data
GET  /dashboard/api/market        // Market data
GET  /dashboard/api/health        // System health
```

#### Response Format Standard
```javascript
// Success
{
  data: { ... },
  timestamp: "2025-11-29T12:00:00Z",
  cached?: boolean
}

// Error
{
  error: "Error message",
  code?: "ERROR_CODE",
  timestamp: "2025-11-29T12:00:00Z"
}
```

### Frontend Developers: What APIs You Can Call

#### Available Endpoints (Mock or Real)
```javascript
// Use the API client library (to be created in Phase 1)
import { CryptoIntelAPI } from './api-client';

const api = new CryptoIntelAPI('http://localhost:8787');

// Get health status
const health = await api.getHealth();

// Get signals
const signals = await api.getSignals({ limit: 50, type: 'sentiment_shift' });

// Get market data
const btcData = await api.getMarketData('bitcoin');

// Get market analysis
const analysis = await api.getMarketAnalysis(['bitcoin', 'ethereum']);

// DEX endpoints
const dexPairs = await api.getDexPairs();
const dexSignals = await api.getDexSignals({ limit: 20 });
const pairAnalysis = await api.getDexAnalysis('pair_123');

// Dashboard data
const stats = await api.getDashboardStats();
const transactions = await api.getDashboardTransactions({ range: '7d' });
```

#### Mock Data for Development
```javascript
// Create mock responses based on API contracts
const mockSignals = {
  signals: [
    {
      id: 'sig_123',
      source: 'coingecko',
      type: 'volume_anomaly',
      entity: 'bitcoin',
      confidence_score: 0.85,
      timestamp: Date.now(),
      data: { volume_increase: '250%' }
    }
  ],
  count: 1,
  timestamp: new Date().toISOString()
};
```

---

## Critical Paths & Blockers

### What Blocks What?

#### Phase 1 (Week 1-2)
**Blockers**: None - can start immediately
**Outputs**: API contracts, core endpoints, dashboard layout

#### Phase 2 (Week 2-4)
**Blocked by**: Phase 1 backend APIs must be complete
**Outputs**: Data collection, DEX endpoints, real-time dashboard

#### Phase 3 (Week 4-5)
**Blocked by**: Phase 2 data collection must be operational
**Outputs**: Advanced analytics, ML signals, pattern recognition

#### Phase 4 (Week 5-6)
**Blocked by**: Phase 1 APIs (minimal dependency)
**Outputs**: Payment integration, revenue tracking

#### Phase 5 (Week 6-7)
**Blocked by**: Phase 2 & 3 must be complete
**Outputs**: WebSocket streaming, live updates

#### Phase 6 (Week 7-8)
**Blocked by**: All previous phases
**Outputs**: Testing, deployment, documentation

### Can I Start Now?

**Backend Developer**:
- ✅ YES - Start with Phase 1 immediately
- ✅ Create database schema and core APIs
- ⏳ Wait for nothing - you're on the critical path

**Frontend Developer**:
- ✅ YES - Start with Phase 1 immediately
- ✅ Use mock APIs for development
- ⏳ Wait for backend APIs for integration testing (Week 2)

**Infrastructure**:
- ✅ YES - Start with Phase 1 immediately
- ✅ Setup deployment pipeline and monitoring
- ⏳ Wait for nothing - infrastructure is parallel

---

## Troubleshooting

### "Module not found" errors
```bash
# Clean install
rm -rf node_modules
rm package-lock.json
npm install
```

### "Database not found" in D1
```bash
# Check if database exists
wrangler d1 list

# Create if missing
wrangler d1 create CRYPTOINTEL_DB

# Update wrangler.toml with database_id
# Run migration
npm run db:migrate
```

### "Rate limit exceeded" in development
```bash
# Clear KV cache
wrangler kv:key list --namespace-id=YOUR_KV_ID
wrangler kv:key delete "rate_limit:coingecko:XXX" --namespace-id=YOUR_KV_ID

# Or use local persistent mode
npm run local
```

### "Wrangler command not found"
```bash
# Install globally
npm install -g wrangler

# Or use npx
npx wrangler dev
```

### "Permission denied" errors (Windows)
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Tests failing
```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test
npm test test/index.test.js

# Check test environment
npm test -- --environment=miniflare
```

---

## Communication & Collaboration

### Daily Standup Format
1. **What I did yesterday**: Task completed, blockers resolved
2. **What I'm doing today**: Current task, estimated completion
3. **Blockers**: Dependencies, issues, questions

### Code Review Checklist
- [ ] Code follows project style guide
- [ ] Unit tests included (80% coverage)
- [ ] API contracts respected
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Performance considered
- [ ] Security reviewed

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/TICKET-XXX-description

# Commit with descriptive messages
git commit -m "feat(scope): add DEX pairs endpoint

- Implement /dex/pairs endpoint
- Add caching with 5-minute TTL
- Include network and DEX data
- Add unit tests

Closes TICKET-001"

# Push and create PR
git push origin feature/TICKET-XXX-description
# Open pull request on GitHub
```

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]

Types: feat, fix, docs, style, refactor, test, chore
Scopes: backend, frontend, infra, api, dashboard, dex, x402
```

---

## Performance Targets

### Backend
- API response time: <500ms (95th percentile)
- Database query time: <200ms
- Cron job execution: <30s
- Cache hit rate: >80%

### Frontend
- Dashboard load time: <2s
- Chart render time: <500ms
- WebSocket latency: <50ms
- Bundle size: <500KB

### System
- Uptime: >99.5%
- Error rate: <1%
- Data collection success: >95%
- Test coverage: >80%

---

## Resources & Links

### Documentation
- [Main Project Plan](PROJECT_PLAN_PARALLEL_DEVELOPMENT.md)
- [Project Overview (CLAUDE.md)](CLAUDE.md)
- [API Documentation](docs/README.md)
- [DEX APIs](docs/coinmarketcap-dex-apis.md)

### External Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Hono.js Guide](https://hono.dev/)
- [Vitest Documentation](https://vitest.dev/)

### Team Communication
- GitHub Issues: Track bugs and features
- Pull Requests: Code review and discussion
- Ticket System: `.tickets/active/` directory

### API Keys & Secrets
- CoinGecko: https://www.coingecko.com/en/api
- CoinMarketCap: https://coinmarketcap.com/api/
- Get keys from team lead

---

## Milestone Checklist

### Week 1-2: Foundation ✅
- [ ] Database schema applied
- [ ] Core API endpoints working
- [ ] Dashboard layout complete
- [ ] Deployment pipeline operational

### Week 2-4: Data Collection ✅
- [ ] All 4 data sources integrated
- [ ] DEX endpoints operational
- [ ] Real-time dashboard functional
- [ ] Cron job running every 15 minutes

### Week 4-5: Analytics ✅
- [ ] Signal correlation working
- [ ] Pattern recognition functional
- [ ] Advanced dashboard complete
- [ ] Confidence scoring >70%

### Week 5-6: Monetization ✅
- [ ] x402 payment integration complete
- [ ] Transaction tracking operational
- [ ] Revenue dashboard functional
- [ ] Payment flow tested end-to-end

### Week 6-7: Real-Time ✅
- [ ] WebSocket server operational
- [ ] Live dashboard updates working
- [ ] Connection stability >95%
- [ ] Latency <50ms

### Week 7-8: Production Ready ✅
- [ ] Test coverage >80%
- [ ] All tests passing
- [ ] Production deployed
- [ ] Monitoring operational
- [ ] Documentation complete

---

**Good luck and happy coding!**

For questions or issues, refer to the main [PROJECT_PLAN_PARALLEL_DEVELOPMENT.md](PROJECT_PLAN_PARALLEL_DEVELOPMENT.md) or ask your team lead.
