# TICKET-XXX: [Bug Title]

## Status
- [ ] Reproduced
- [ ] Root Cause Identified
- [ ] Fix Implemented
- [ ] Tested
- [ ] Merged

## Type
Bugfix

## Priority
- [ ] Critical (P0) - Production down
- [ ] High (P1) - Major functionality broken
- [ ] Medium (P2) - Minor functionality affected
- [ ] Low (P3) - Cosmetic issue

## Bug Description
### Summary
Brief description of the bug.

### Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

### Expected Behavior
What should happen.

### Actual Behavior
What actually happens.

### Environment
- Environment: production/staging/development
- Browser/Client:
- API Version:
- Database State:

## Root Cause Analysis
Description of why the bug occurs.

## Solution
### Fix Implementation
Description of the fix.

### Files Modified
- [ ] `src/index.js` - Fix logic error
- [ ] `test/index.test.js` - Add regression test

## Testing
### Regression Tests
- [ ] Test case added to prevent recurrence
- [ ] Existing tests still pass
- [ ] Manual verification completed

### Verification Steps
1. Step to verify fix
2. Step to verify fix
3. Step to verify fix

## Worktree Setup
```bash
git worktree add .tickets/worktrees/TICKET-XXX -b bugfix/TICKET-XXX-bug-name
cd .tickets/worktrees/TICKET-XXX
npm install
npm test
```

## Related Issues
- GitHub Issue: #XXX
- Originally introduced in: Commit/PR
- Related Tickets: None

## Post-Mortem
### Impact
- Users affected: X
- Duration: X hours
- Data loss: Yes/No

### Lessons Learned
- What went wrong
- How to prevent in future

## Completion Checklist
- [ ] Bug reproduced locally
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Regression test added
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] Verified in staging
- [ ] Deployed to production
- [ ] Verified in production
- [ ] Worktree removed
- [ ] Ticket archived

## Time Tracking
- Detected: YYYY-MM-DD HH:MM
- Fixed: YYYY-MM-DD HH:MM
- Time to Resolution: X hours