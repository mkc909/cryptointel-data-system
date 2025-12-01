# Git Worktree Setup Guide

## What are Git Worktrees?
Git worktrees allow you to have multiple working directories attached to the same repository, each checked out to a different branch. This enables parallel development without constantly switching branches.

## Prerequisites
- Git 2.5+ installed
- Repository initialized with Git
- Main branch established

## Initial Setup

### 1. Initialize Git Repository (if needed)
```bash
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
git init
git add .
git commit -m "Initial commit"
```

### 2. Setup Remote (if using GitHub)
```bash
git remote add origin https://github.com/YOUR_USERNAME/cryptointel-data-system.git
git push -u origin main
```

## Worktree Management

### Creating a Worktree for a Ticket

#### Option 1: New Feature Branch
```bash
# Create worktree with new branch
git worktree add .tickets/worktrees/TICKET-001 -b feature/TICKET-001-new-api

# The structure will be:
# .tickets/worktrees/TICKET-001/  <- Complete copy of repo on feature branch
```

#### Option 2: Existing Branch
```bash
# Create worktree from existing branch
git worktree add .tickets/worktrees/TICKET-002 bugfix/existing-bug-fix
```

### Working in a Worktree
```bash
# Navigate to worktree
cd .tickets/worktrees/TICKET-001

# Install dependencies (each worktree needs its own node_modules)
npm install

# Start development server
npm run dev

# Make changes, commit as normal
git add .
git commit -m "feat: implement new API endpoint"

# Push changes
git push origin feature/TICKET-001-new-api
```

### Listing All Worktrees
```bash
git worktree list

# Output example:
# C:/dev/GITHUB_MKC909_REPOS/cryptointel-data-system              main
# C:/dev/GITHUB_MKC909_REPOS/cryptointel-data-system/.tickets/worktrees/TICKET-001  feature/TICKET-001-new-api
# C:/dev/GITHUB_MKC909_REPOS/cryptointel-data-system/.tickets/worktrees/TICKET-002  bugfix/TICKET-002-auth-fix
```

### Removing a Worktree

#### After Merging
```bash
# First, merge the branch (from main directory)
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
git merge feature/TICKET-001-new-api

# Remove the worktree
git worktree remove .tickets/worktrees/TICKET-001

# Delete the remote branch
git push origin --delete feature/TICKET-001-new-api
```

#### Without Merging (abandoning work)
```bash
# Force remove worktree
git worktree remove --force .tickets/worktrees/TICKET-001
```

### Cleaning Up Stale Worktrees
```bash
# Remove references to deleted worktrees
git worktree prune
```

## Best Practices

### 1. One Worktree Per Ticket
- Each ticket gets its own worktree
- Prevents cross-contamination of work
- Easy to context switch

### 2. Naming Convention
- Worktree directory: `TICKET-XXX`
- Branch name: `{type}/TICKET-XXX-description`
- Examples:
  - `feature/TICKET-001-add-api-endpoint`
  - `bugfix/TICKET-002-fix-auth-error`
  - `hotfix/TICKET-003-critical-prod-fix`

### 3. Dependencies Management
```bash
# Each worktree needs its own node_modules
cd .tickets/worktrees/TICKET-XXX
npm install

# Add to .gitignore if not already
echo ".tickets/worktrees/*/node_modules" >> .gitignore
```

### 4. Database/Environment Files
```bash
# Copy environment files to each worktree
cp .env .tickets/worktrees/TICKET-XXX/.env

# Or symlink (Windows)
mklink .tickets\worktrees\TICKET-XXX\.env ..\..\..\.env
```

### 5. Testing in Worktrees
```bash
# Each worktree can run tests independently
cd .tickets/worktrees/TICKET-XXX
npm test

# Run development server
npm run dev  # Runs on same port, stop other instances first
```

## Workflow Example

### Complete Feature Development Flow
```bash
# 1. Create ticket
cp .tickets/templates/feature.md .tickets/active/TICKET-004-add-websocket.md

# 2. Create worktree
git worktree add .tickets/worktrees/TICKET-004 -b feature/TICKET-004-add-websocket

# 3. Setup worktree environment
cd .tickets/worktrees/TICKET-004
npm install
cp ../../.env .env

# 4. Develop feature
# ... make changes ...
git add .
git commit -m "feat: add websocket support"
git push origin feature/TICKET-004-add-websocket

# 5. Create PR (using GitHub CLI)
gh pr create --title "TICKET-004: Add websocket support" --body "Implements websocket connectivity"

# 6. After PR merged, cleanup
cd ../..
git checkout main
git pull origin main
git worktree remove .tickets/worktrees/TICKET-004
git branch -d feature/TICKET-004-add-websocket

# 7. Archive ticket
mv .tickets/active/TICKET-004-*.md .tickets/completed/
```

## Troubleshooting

### "fatal: worktree already exists"
```bash
# Remove the existing worktree first
git worktree remove .tickets/worktrees/TICKET-XXX
# Or force remove if there are uncommitted changes
git worktree remove --force .tickets/worktrees/TICKET-XXX
```

### "fatal: branch already exists"
```bash
# Use existing branch
git worktree add .tickets/worktrees/TICKET-XXX existing-branch-name

# Or delete the old branch first
git branch -D old-branch-name
```

### Port conflicts when running dev server
```bash
# Option 1: Stop other dev servers
# Option 2: Use different ports
PORT=3001 npm run dev  # In worktree 1
PORT=3002 npm run dev  # In worktree 2
```

### Worktree shows as "prunable"
```bash
# Clean up stale worktree references
git worktree prune

# List to verify
git worktree list
```

## Advanced Tips

### Parallel Testing
```bash
# Run tests in multiple worktrees simultaneously
# Terminal 1
cd .tickets/worktrees/TICKET-001 && npm test

# Terminal 2
cd .tickets/worktrees/TICKET-002 && npm test
```

### Sharing Changes Between Worktrees
```bash
# Cherry-pick a commit from another worktree
cd .tickets/worktrees/TICKET-001
git cherry-pick {commit-hash-from-TICKET-002}
```

### Worktree Status Dashboard
```bash
# Create a script to show all worktree statuses
for dir in .tickets/worktrees/*/; do
  echo "=== $(basename $dir) ==="
  git -C "$dir" status --short
  echo
done
```

## Integration with CI/CD
```yaml
# GitHub Actions example
name: Test Worktree Branch
on:
  push:
    branches:
      - 'feature/TICKET-*'
      - 'bugfix/TICKET-*'
      - 'hotfix/TICKET-*'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
```

## PowerShell Helper Scripts
Save these as `.ps1` files in `.tickets/scripts/`:

### create-worktree.ps1
```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$TicketNumber,

    [Parameter(Mandatory=$true)]
    [ValidateSet("feature", "bugfix", "hotfix", "chore", "docs")]
    [string]$Type,

    [Parameter(Mandatory=$true)]
    [string]$Description
)

$branchName = "$Type/TICKET-$TicketNumber-$Description"
$worktreePath = ".tickets/worktrees/TICKET-$TicketNumber"

Write-Host "Creating worktree for TICKET-$TicketNumber..." -ForegroundColor Green
git worktree add $worktreePath -b $branchName

Write-Host "Setting up environment..." -ForegroundColor Green
Set-Location $worktreePath
npm install

Write-Host "Worktree created successfully!" -ForegroundColor Green
Write-Host "Navigate to: $worktreePath" -ForegroundColor Yellow
```

### cleanup-worktree.ps1
```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$TicketNumber
)

$worktreePath = ".tickets/worktrees/TICKET-$TicketNumber"

Write-Host "Removing worktree for TICKET-$TicketNumber..." -ForegroundColor Yellow
git worktree remove $worktreePath

Write-Host "Archiving ticket..." -ForegroundColor Yellow
Move-Item ".tickets/active/TICKET-$TicketNumber-*.md" ".tickets/completed/"

Write-Host "Cleanup complete!" -ForegroundColor Green
```