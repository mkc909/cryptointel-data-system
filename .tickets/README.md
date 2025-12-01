# Ticket Management System

## Overview
This ticket management system integrates with GitHub worktrees to provide isolated development environments for each ticket, enabling parallel development without branch conflicts.

## Directory Structure
```
.tickets/
├── active/           # Currently in-progress tickets
├── completed/        # Archived completed tickets
├── templates/        # Ticket templates
├── worktrees/        # Git worktree checkouts (one per ticket)
├── docs/             # System documentation
└── README.md         # This file
```

## Ticket Workflow

### 1. Create New Ticket
```bash
# Use the ticket creation script
./scripts/create-ticket.ps1 -Type feature -Title "Add new API endpoint"

# Or manually create using template
cp .tickets/templates/feature.md .tickets/active/TICKET-001-add-api-endpoint.md
```

### 2. Setup Worktree
```bash
# Create worktree for ticket
git worktree add .tickets/worktrees/TICKET-001 -b feature/TICKET-001-add-api-endpoint

# Navigate to worktree
cd .tickets/worktrees/TICKET-001
```

### 3. Development
- Work in the isolated worktree
- Each ticket has its own branch and working directory
- No conflicts with other tickets in progress

### 4. Complete Ticket
```bash
# Merge changes
git checkout main
git merge feature/TICKET-001-add-api-endpoint

# Clean up worktree
git worktree remove .tickets/worktrees/TICKET-001

# Archive ticket
mv .tickets/active/TICKET-001-*.md .tickets/completed/
```

## Ticket Naming Convention
Format: `TICKET-{NUMBER}-{kebab-case-title}.md`
- TICKET-001-add-api-endpoint.md
- TICKET-002-fix-auth-bug.md
- TICKET-003-update-documentation.md

## Ticket Types
- **feature**: New functionality
- **bugfix**: Bug fixes
- **hotfix**: Critical production fixes
- **chore**: Maintenance tasks
- **docs**: Documentation updates
- **refactor**: Code improvements

## Integration with GitHub Issues
Tickets can be synchronized with GitHub Issues:
1. Create ticket locally
2. Push to GitHub as issue
3. Link worktree branch to issue
4. Auto-close issue on merge

## Benefits
- **Parallel Development**: Work on multiple features simultaneously
- **Clean Workspace**: Each ticket has isolated environment
- **No Branch Conflicts**: Separate working directories
- **Easy Context Switching**: Jump between tickets instantly
- **Complete History**: Archived tickets provide development history

## Quick Commands

### List Active Tickets
```bash
ls .tickets/active/
```

### Show All Worktrees
```bash
git worktree list
```

### Switch to Ticket Worktree
```bash
cd .tickets/worktrees/TICKET-XXX
```

### Clean Completed Worktrees
```bash
git worktree prune
```

## Next Actions
See [NEXT_ACTIONS.md](.tickets/docs/NEXT_ACTIONS.md) for implementation roadmap.