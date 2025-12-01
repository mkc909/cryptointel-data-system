#!/bin/bash

# Navigate to repository
cd cryptointel-data-system

# Issue #1 (completed)
gh issue create --title "Deploy Database Optimizations & Enhanced Dashboard" \
  --body "$(cat ISSUE1_COMPLETION.md)" \
  --label "enhancement,deployed,completed,database,dashboard" \
  --assignee @me

gh issue close 1 --comment "Successfully completed and deployed. See ISSUE1_COMPLETION.md for full details."

# Issue #2
gh issue create --title "Advanced ML-Based Signal Detection" \
  --label "enhancement,ml,high-priority,signal-detection" \
  --assignee @me \
  --body "Implement ML algorithms for signal detection. Estimated: 1 week. See TICKET_TRACKER.md for details."

# Issue #3
gh issue create --title "Real-time WebSocket Updates" \
  --label "enhancement,websocket,medium-priority,real-time" \
  --assignee @me \
  --body "Replace SSE with WebSocket. Estimated: 3-5 days. See TICKET_TRACKER.md for details."

# Issue #4
gh issue create --title "Mobile App Development" \
  --label "enhancement,mobile,medium-priority,pwa" \
  --assignee @me \
  --body "Develop PWA with offline support. Estimated: 2 weeks. See TICKET_TRACKER.md for details."

# Issue #5
gh issue create --title "Advanced Analytics Dashboard" \
  --label "enhancement,analytics,medium-priority,dashboard" \
  --assignee @me \
  --body "Build advanced analytics. Estimated: 1 week. See TICKET_TRACKER.md for details."

# Issue #6
gh issue create --title "API Rate Limit Optimization" \
  --label "enhancement,optimization,low-priority,performance" \
  --assignee @me \
  --body "Optimize API rate limits. Estimated: 3 days. See TICKET_TRACKER.md for details."

# Issue #7
gh issue create --title "Multi-region Deployment" \
  --label "enhancement,infrastructure,low-priority,deployment" \
  --assignee @me \
  --body "Deploy to multiple regions. Estimated: 1 week. See TICKET_TRACKER.md for details."

# Issue #8
gh issue create --title "Advanced Caching Strategy" \
  --label "enhancement,caching,low-priority,performance" \
  --assignee @me \
  --body "Implement advanced caching. Estimated: 3 days. See TICKET_TRACKER.md for details."

echo "All issues created successfully!"