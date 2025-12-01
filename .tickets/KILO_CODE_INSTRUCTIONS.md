# Instructions for Kilo Code Team

## 📋 How to Work with the Ticket System

### Your Active Tickets

All tickets are in: `.tickets\active\`

Current priorities:
1. **TICKET-001-complete-dex-api-integration.md** (P1 - TIME SENSITIVE)
2. **TICKET-002-implement-advanced-signal-detection.md** (P1)
3. **TICKET-003-add-websocket-support.md** (P2)

### 📖 How to Read Your Assignment

1. **Open the ticket file**:
```bash
# Navigate to tickets folder
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system\.tickets\active\

# Read your ticket
notepad TICKET-001-complete-dex-api-integration.md
```

2. **The ticket contains**:
   - Description of work
   - Acceptance criteria
   - Technical implementation details
   - Files to modify
   - Testing requirements
   - Completion checklist

### 🚀 How to Start Work (After Git is Setup)

1. **Create a worktree for your ticket**:
```bash
# From project root
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

# Create worktree for TICKET-001
git worktree add .tickets\worktrees\TICKET-001 -b feature/TICKET-001-dex-api-integration

# Navigate to your isolated workspace
cd .tickets\worktrees\TICKET-001
```

2. **Install dependencies in worktree**:
```bash
npm install
```

3. **Copy environment files**:
```bash
# Copy from main project
copy ..\..\..\.env .env
```

4. **Start development**:
```bash
npm run dev
```

### 💻 While Working

- You're in an isolated directory - no conflicts with other developers
- All changes stay in your branch
- Test freely without affecting main code

### ✅ Progress Tracking

Update your ticket file status as you work:

1. Edit the ticket markdown file
2. Check off completed items:
   - Change `- [ ]` to `- [x]` for completed tasks
3. Update the Status section when milestones are reached

Example:
```markdown
## Status
- [x] In Progress
- [x] Code Complete
- [ ] Tested
- [ ] Reviewed
- [ ] Merged
```

### 📝 When You Complete Work

1. **Run tests**:
```bash
npm test
npm run test:integration
```

2. **Commit your changes**:
```bash
git add .
git commit -m "feat: complete TICKET-001 DEX API integration

- Implemented all 8 endpoints
- Added rate limiting
- Created tests with 85% coverage"
```

3. **Push to remote** (if Git remote is setup):
```bash
git push origin feature/TICKET-001-dex-api-integration
```

4. **Report completion** with:
   - What was completed
   - Test results
   - Any issues encountered
   - Metrics (API calls made, signals detected, etc.)

### 🎯 Priority Order for Kilo Code

## Assignment #1: TICKET-001 - DEX API Integration
**WHO**: Backend Developer
**DEADLINE**: 3 days
**WHY URGENT**: CoinMarketCap offering 1 million FREE API credits/month during soft launch (worth $400/month). This could end anytime!

**Quick Summary**:
- Implement 8 CoinMarketCap DEX v4 endpoints
- Add to `src/index.js`
- Create DEX tables in database
- Add signal detection for DEX patterns
- Must respect 300 requests/minute limit

**Start Here**: `.tickets\active\TICKET-001-complete-dex-api-integration.md`

---

## Assignment #2: TICKET-002 - Advanced Signal Detection
**WHO**: ML/Data Engineer
**DEADLINE**: 5 days
**DEPENDS ON**: Some DEX data from TICKET-001

**Quick Summary**:
- Build ML pattern recognition
- Create compound signals (whale_accumulation, breakout_pattern, etc.)
- Implement confidence scoring
- Target >70% accuracy
- Add multi-source correlation

**Start Here**: `.tickets\active\TICKET-002-implement-advanced-signal-detection.md`

---

## Assignment #3: TICKET-003 - WebSocket Support
**WHO**: Full Stack Developer
**DEADLINE**: 7 days
**DEPENDS ON**: Signals from TICKET-002

**Quick Summary**:
- Implement WebSocket server on Cloudflare Workers
- Use Durable Objects for connections
- Create client library
- Enable real-time price updates
- Add to dashboard

**Start Here**: `.tickets\active\TICKET-003-add-websocket-support.md`

### 🔧 If You Need to Use PowerShell Scripts

**Check status of all tickets**:
```powershell
.\.tickets\scripts\ticket-status.ps1
```

**Complete a ticket** (after merging):
```powershell
.\.tickets\scripts\complete-ticket.ps1 -TicketNumber 001
```

### ⚠️ Important Notes

1. **DON'T** modify files outside your worktree
2. **DO** update ticket status in the markdown file
3. **DO** run tests before marking complete
4. **DO** document any blockers or issues

### 📊 What to Report Back

For each ticket, report:

1. **Completion Status**
   - Percentage complete
   - Checklist items done

2. **Metrics**
   - For TICKET-001: Number of endpoints working, API credits used
   - For TICKET-002: Signal accuracy percentage, patterns detected
   - For TICKET-003: WebSocket connections tested, latency achieved

3. **Issues/Blockers**
   - Any problems encountered
   - Missing dependencies
   - Questions about implementation

4. **Test Results**
   - Test coverage percentage
   - Number of tests passing/failing

### 🚫 What NOT to Do

- Don't work directly in the main directory
- Don't skip the testing requirements
- Don't exceed API rate limits (especially for TICKET-001)
- Don't merge without tests passing

---

## Summary: Just Start with the Ticket Files!

1. Read `.tickets\active\TICKET-XXX-*.md`
2. Follow the implementation plan inside
3. Check off tasks as you complete them
4. Report back with results

The ticket files have EVERYTHING you need:
- Implementation details
- Code examples
- Database schemas
- Test requirements
- Success criteria

**Start with TICKET-001 immediately to capture the free API credits!**