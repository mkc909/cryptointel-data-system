# Git Setup Guide for Ticket System

## Prerequisites Installation

### 1. Install Git for Windows
Download and install from: https://git-scm.com/download/win

During installation, ensure:
- Git Bash is included
- Git is added to PATH
- Line ending conversions are set to "Checkout Windows-style, commit Unix-style"

### 2. Verify Installation
Open PowerShell or Command Prompt and run:
```bash
git --version
```
Expected output: `git version 2.x.x`

## Initial Repository Setup

### Step 1: Initialize Repository
```bash
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

# Initialize Git
git init

# Configure user (replace with your info)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Step 2: Create Initial Commit
```bash
# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: CryptoIntel Data System with ticket management"
```

### Step 3: Add GitHub Remote (Optional)
```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/cryptointel-data-system.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Worktree Setup for Tickets

### Enable Worktree Feature
Once Git is initialized, you can use worktrees for parallel development:

```bash
# Verify worktree support
git worktree list

# Should show:
# C:/dev/GITHUB_MKC909_REPOS/cryptointel-data-system  [main]
```

### Create First Worktree
```bash
# For TICKET-001
git worktree add .tickets/worktrees/TICKET-001 -b feature/TICKET-001-dex-api-integration

# Navigate to worktree
cd .tickets/worktrees/TICKET-001

# Install dependencies
npm install

# Copy environment files
cp ../../.env .env
cp ../../.env.local .env.local  # if exists
```

## PowerShell Script Configuration

### Enable PowerShell Scripts
If you get "execution policy" errors:

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or for current session only
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### Test Scripts
```powershell
# Should now work
.\.tickets\scripts\ticket-status.ps1
```

## GitHub CLI Integration (Optional)

### Install GitHub CLI
Download from: https://cli.github.com/

### Authenticate
```bash
gh auth login
```

### Use with Tickets
```bash
# Create PR from ticket branch
gh pr create --title "TICKET-001: Complete DEX API Integration" --body "Implements 8 new CoinMarketCap DEX endpoints"

# List PRs
gh pr list

# Check CI status
gh pr checks
```

## Troubleshooting

### "fatal: not a git repository"
```bash
# Ensure you're in the right directory
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system

# Initialize Git
git init
```

### "fatal: ambiguous argument 'HEAD'"
```bash
# No commits yet, create initial commit
git add .
git commit -m "Initial commit"
```

### PowerShell scripts not running
```powershell
# Unblock downloaded scripts
Get-ChildItem .\.tickets\scripts\*.ps1 | Unblock-File

# Or run with bypass
powershell -ExecutionPolicy Bypass -File .\.tickets\scripts\ticket-status.ps1
```

### Worktree already exists
```bash
# Remove existing worktree
git worktree remove .tickets/worktrees/TICKET-001

# Or force remove
git worktree remove --force .tickets/worktrees/TICKET-001
```

## Quick Command Reference

```bash
# Initialize Git
git init

# Create worktree for ticket
git worktree add .tickets/worktrees/TICKET-XXX -b feature/TICKET-XXX-description

# List all worktrees
git worktree list

# Remove worktree
git worktree remove .tickets/worktrees/TICKET-XXX

# Clean up stale worktrees
git worktree prune

# Check branch status
git branch -a

# Delete merged branches
git branch --merged | grep -v main | xargs git branch -d
```

## Next Steps After Git Setup

1. ✅ Install Git for Windows
2. ✅ Initialize repository with `git init`
3. ✅ Create initial commit
4. ✅ Test PowerShell scripts
5. ✅ Create first worktree with existing tickets
6. ✅ Start development!

---
**Note**: The ticket system can work without Git for basic ticket tracking, but Git worktrees provide the full parallel development experience.