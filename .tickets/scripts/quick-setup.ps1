# Quick Setup Script for Ticket System
# Run this after Git is initialized to quickly set everything up

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   TICKET SYSTEM QUICK SETUP WIZARD     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Get paths
$rootPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ticketsPath = Join-Path $rootPath ".tickets"

Set-Location $rootPath

# Step 1: Check Git
Write-Host "`n1. Checking Git status..." -ForegroundColor Green
$gitStatus = git status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "   Git not initialized. Initializing now..." -ForegroundColor Yellow
    git init
    Write-Host "   Git initialized!" -ForegroundColor Green

    # Add gitignore entries
    Write-Host "`n2. Adding .gitignore entries..." -ForegroundColor Green
    $gitignoreContent = @"

# Ticket System
.tickets/worktrees/*/node_modules/
.tickets/worktrees/*/.env
.tickets/worktrees/*/.env.local
.tickets/worktrees/*/dist/
.tickets/worktrees/*/build/
.tickets/worktrees/*/.wrangler/
.tickets/logs/
.tickets/*.tmp
"@

    Add-Content -Path ".gitignore" -Value $gitignoreContent
    Write-Host "   .gitignore updated!" -ForegroundColor Green
} else {
    Write-Host "   Git already initialized!" -ForegroundColor Green
}

# Step 2: Create initial commit if needed
$hasCommits = git log --oneline -n 1 2>$null
if (-not $hasCommits) {
    Write-Host "`n3. Creating initial commit..." -ForegroundColor Green
    git add .
    git commit -m "Initial commit with ticket management system"
    Write-Host "   Initial commit created!" -ForegroundColor Green
}

# Step 3: Create example ticket
Write-Host "`n4. Creating example ticket..." -ForegroundColor Green
$exampleTicketPath = Join-Path $ticketsPath "active" "TICKET-000-example.md"

if (-not (Test-Path $exampleTicketPath)) {
    $exampleContent = @"
# TICKET-000: Example Ticket

## Status
- [x] In Progress
- [ ] Code Complete
- [ ] Tested
- [ ] Reviewed
- [ ] Merged

## Type
Feature

## Priority
- [ ] Critical (P0)
- [ ] High (P1)
- [x] Medium (P2)
- [ ] Low (P3)

## Description
This is an example ticket to demonstrate the ticket system workflow.

## Acceptance Criteria
- [ ] Ticket system is understood
- [ ] Worktree workflow is clear
- [ ] Scripts are tested

## Notes
This ticket can be used to test the ticket management scripts.
You can safely delete this ticket once you're familiar with the system.

## Worktree Setup
\`\`\`bash
git worktree add .tickets/worktrees/TICKET-000 -b feature/TICKET-000-example
cd .tickets/worktrees/TICKET-000
npm install
\`\`\`
"@

    Set-Content -Path $exampleTicketPath -Value $exampleContent
    Write-Host "   Example ticket created!" -ForegroundColor Green
}

# Step 4: Make scripts executable
Write-Host "`n5. Setting up PowerShell scripts..." -ForegroundColor Green
$scripts = @(
    "create-ticket.ps1",
    "complete-ticket.ps1",
    "ticket-status.ps1",
    "quick-setup.ps1"
)

foreach ($script in $scripts) {
    $scriptPath = Join-Path $ticketsPath "scripts" $script
    if (Test-Path $scriptPath) {
        # Unblock the script
        Unblock-File -Path $scriptPath 2>$null
    }
}
Write-Host "   Scripts ready to use!" -ForegroundColor Green

# Step 5: Test the system
Write-Host "`n6. Testing ticket system..." -ForegroundColor Green
Write-Host "   Running status check..." -ForegroundColor Gray

# Run status script
& "$ticketsPath\scripts\ticket-status.ps1"

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "      SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n📚 Quick Start Guide:" -ForegroundColor Yellow
Write-Host "────────────────────" -ForegroundColor Gray

Write-Host "`nCreate a new ticket:" -ForegroundColor White
Write-Host "  PS> " -NoNewline -ForegroundColor DarkGray
Write-Host ".\.tickets\scripts\create-ticket.ps1 -TicketNumber 001 -Type feature -Title 'my-feature' -Priority P2" -ForegroundColor Cyan

Write-Host "`nCheck ticket status:" -ForegroundColor White
Write-Host "  PS> " -NoNewline -ForegroundColor DarkGray
Write-Host ".\.tickets\scripts\ticket-status.ps1" -ForegroundColor Cyan

Write-Host "`nComplete a ticket:" -ForegroundColor White
Write-Host "  PS> " -NoNewline -ForegroundColor DarkGray
Write-Host ".\.tickets\scripts\complete-ticket.ps1 -TicketNumber 001 -MergeBranch" -ForegroundColor Cyan

Write-Host "`n📖 Documentation:" -ForegroundColor Yellow
Write-Host "────────────────" -ForegroundColor Gray
Write-Host "  Main README:     .tickets\README.md" -ForegroundColor White
Write-Host "  Worktree Guide:  .tickets\docs\WORKTREE_SETUP.md" -ForegroundColor White
Write-Host "  Next Actions:    .tickets\docs\NEXT_ACTIONS.md" -ForegroundColor White

Write-Host "`n🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "─────────────" -ForegroundColor Gray
Write-Host "  1. Review the documentation" -ForegroundColor White
Write-Host "  2. Create your first real ticket" -ForegroundColor White
Write-Host "  3. Set up GitHub remote (if needed)" -ForegroundColor White
Write-Host "  4. Start developing with worktrees!" -ForegroundColor White

Write-Host "`n✨ Happy coding with ticket-driven development!" -ForegroundColor Green
Write-Host ""