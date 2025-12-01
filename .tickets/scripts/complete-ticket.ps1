# Complete Ticket Script
# Usage: .\complete-ticket.ps1 -TicketNumber 001 [-MergeBranch] [-DeleteRemoteBranch]

param(
    [Parameter(Mandatory=$true)]
    [string]$TicketNumber,

    [Parameter(Mandatory=$false)]
    [switch]$MergeBranch = $false,

    [Parameter(Mandatory=$false)]
    [switch]$DeleteRemoteBranch = $false,

    [Parameter(Mandatory=$false)]
    [switch]$KeepWorktree = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

# Paths
$rootPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ticketsPath = Join-Path $rootPath ".tickets"
$activePath = Join-Path $ticketsPath "active"
$completedPath = Join-Path $ticketsPath "completed"
$worktreePath = Join-Path $ticketsPath "worktrees" "TICKET-$TicketNumber"

Write-Host "`n=== Completing TICKET-$TicketNumber ===" -ForegroundColor Cyan

# Step 1: Find ticket file
Write-Host "`n1. Finding ticket file..." -ForegroundColor Green
$ticketFiles = Get-ChildItem $activePath -Filter "TICKET-$TicketNumber-*.md"

if ($ticketFiles.Count -eq 0) {
    Write-Host "   No active ticket found for TICKET-$TicketNumber" -ForegroundColor Red
    exit 1
}

$ticketFile = $ticketFiles[0]
$ticketName = $ticketFile.BaseName
Write-Host "   Found: $($ticketFile.Name)" -ForegroundColor Green

# Step 2: Check worktree status
Write-Host "`n2. Checking worktree status..." -ForegroundColor Green
Set-Location $rootPath

$worktrees = git worktree list | Select-String "TICKET-$TicketNumber"
if ($worktrees) {
    Write-Host "   Worktree exists: $worktreePath" -ForegroundColor Green

    # Check for uncommitted changes
    Set-Location $worktreePath
    $status = git status --porcelain
    if ($status -and -not $Force) {
        Write-Host "   WARNING: Uncommitted changes in worktree!" -ForegroundColor Red
        Write-Host $status
        $continue = Read-Host "   Continue anyway? (y/N)"
        if ($continue -ne 'y') {
            Write-Host "   Aborted. Commit or stash changes first." -ForegroundColor Red
            exit 1
        }
    }

    # Get branch name
    $branchInfo = git branch --show-current
    $branchName = $branchInfo.Trim()
    Write-Host "   Branch: $branchName" -ForegroundColor Green
} else {
    Write-Host "   No worktree found" -ForegroundColor Yellow
    $KeepWorktree = $true  # Nothing to remove
}

# Step 3: Merge branch (optional)
if ($MergeBranch -and $branchName) {
    Write-Host "`n3. Merging branch..." -ForegroundColor Green
    Set-Location $rootPath

    # Checkout main branch
    git checkout main

    # Pull latest changes
    Write-Host "   Pulling latest main..." -ForegroundColor Green
    git pull origin main

    # Merge feature branch
    Write-Host "   Merging $branchName..." -ForegroundColor Green
    $mergeResult = git merge $branchName 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Merge failed! Resolve conflicts manually." -ForegroundColor Red
        Write-Host $mergeResult
        exit 1
    }

    Write-Host "   Merged successfully!" -ForegroundColor Green

    # Push to remote
    $push = Read-Host "   Push to remote? (y/N)"
    if ($push -eq 'y') {
        git push origin main
        Write-Host "   Pushed to remote" -ForegroundColor Green
    }
}

# Step 4: Remove worktree
if (-not $KeepWorktree -and $worktrees) {
    Write-Host "`n4. Removing worktree..." -ForegroundColor Green
    Set-Location $rootPath

    if ($Force) {
        git worktree remove --force $worktreePath
    } else {
        git worktree remove $worktreePath
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Worktree removed" -ForegroundColor Green
    } else {
        Write-Host "   Failed to remove worktree. Use -Force flag to override." -ForegroundColor Red
    }
}

# Step 5: Delete local and remote branches
if ($branchName -and -not $KeepWorktree) {
    Write-Host "`n5. Cleaning up branches..." -ForegroundColor Green
    Set-Location $rootPath

    # Delete local branch
    Write-Host "   Deleting local branch: $branchName" -ForegroundColor Green
    git branch -d $branchName 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Using force delete for local branch" -ForegroundColor Yellow
        git branch -D $branchName
    }

    # Delete remote branch (optional)
    if ($DeleteRemoteBranch) {
        Write-Host "   Deleting remote branch: origin/$branchName" -ForegroundColor Green
        git push origin --delete $branchName 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Remote branch deleted" -ForegroundColor Green
        } else {
            Write-Host "   Failed to delete remote branch (may not exist)" -ForegroundColor Yellow
        }
    }
}

# Step 6: Archive ticket
Write-Host "`n6. Archiving ticket..." -ForegroundColor Green

# Update ticket completion date
$content = Get-Content $ticketFile.FullName -Raw
$today = Get-Date -Format "yyyy-MM-dd"
$content = $content -replace "Completed: YYYY-MM-DD", "Completed: $today"
$content = $content -replace "- \[ \] Merged", "- [x] Merged"
$content = $content -replace "- \[ \] Ticket archived", "- [x] Ticket archived"

# Create completed directory for the month if it doesn't exist
$monthDir = Get-Date -Format "yyyy-MM"
$monthPath = Join-Path $completedPath $monthDir
if (-not (Test-Path $monthPath)) {
    New-Item -ItemType Directory -Path $monthPath | Out-Null
}

# Move ticket to completed
$completedFile = Join-Path $monthPath $ticketFile.Name
Set-Content -Path $completedFile -Value $content
Remove-Item $ticketFile.FullName

Write-Host "   Moved to: $completedFile" -ForegroundColor Green

# Step 7: Summary
Write-Host "`n=== Ticket Completed Successfully ===" -ForegroundColor Cyan
Write-Host "Ticket:    $ticketName" -ForegroundColor White
Write-Host "Archived:  $completedFile" -ForegroundColor White

if ($MergeBranch) {
    Write-Host "Branch:    Merged into main" -ForegroundColor White
}

if (-not $KeepWorktree) {
    Write-Host "Worktree:  Removed" -ForegroundColor White
}

# Final cleanup
Write-Host "`n7. Running git worktree prune..." -ForegroundColor Green
git worktree prune

Write-Host "`nDone!" -ForegroundColor Green