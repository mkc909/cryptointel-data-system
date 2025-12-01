# Create Ticket and Worktree Script
# Usage: .\create-ticket.ps1 -TicketNumber 001 -Type feature -Title "add-api-endpoint" -Priority P1

param(
    [Parameter(Mandatory=$true)]
    [string]$TicketNumber,

    [Parameter(Mandatory=$true)]
    [ValidateSet("feature", "bugfix", "hotfix", "chore", "docs", "refactor")]
    [string]$Type,

    [Parameter(Mandatory=$true)]
    [string]$Title,

    [Parameter(Mandatory=$false)]
    [ValidateSet("P0", "P1", "P2", "P3")]
    [string]$Priority = "P2",

    [Parameter(Mandatory=$false)]
    [switch]$CreateWorktree = $true,

    [Parameter(Mandatory=$false)]
    [switch]$OpenInVSCode = $false
)

$ErrorActionPreference = "Stop"

# Paths
$rootPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ticketsPath = Join-Path $rootPath ".tickets"
$activePath = Join-Path $ticketsPath "active"
$templatesPath = Join-Path $ticketsPath "templates"
$worktreesPath = Join-Path $ticketsPath "worktrees"

# Ticket and branch names
$ticketName = "TICKET-$TicketNumber-$Title"
$ticketFile = Join-Path $activePath "$ticketName.md"
$branchName = "$Type/$ticketName"
$worktreePath = Join-Path $worktreesPath "TICKET-$TicketNumber"

Write-Host "`n=== Creating Ticket $ticketName ===" -ForegroundColor Cyan

# Step 1: Create ticket from template
Write-Host "`n1. Creating ticket file..." -ForegroundColor Green
$templateFile = Join-Path $templatesPath "$Type.md"

if (-not (Test-Path $templateFile)) {
    Write-Host "   Using default feature template" -ForegroundColor Yellow
    $templateFile = Join-Path $templatesPath "feature.md"
}

if (Test-Path $ticketFile) {
    Write-Host "   Ticket already exists: $ticketFile" -ForegroundColor Yellow
    $overwrite = Read-Host "   Overwrite? (y/N)"
    if ($overwrite -ne 'y') {
        Write-Host "   Aborted." -ForegroundColor Red
        exit 1
    }
}

# Copy and update template
$content = Get-Content $templateFile -Raw
$content = $content -replace "TICKET-XXX", "TICKET-$TicketNumber"
$content = $content -replace "\[Feature Title\]", $Title.Replace("-", " ")
$content = $content -replace "\[Bug Title\]", $Title.Replace("-", " ")
$content = $content -replace "feature-name", $Title
$content = $content -replace "bug-name", $Title

# Set priority
$priorities = @("Critical \(P0\)", "High \(P1\)", "Medium \(P2\)", "Low \(P3\)")
foreach ($p in $priorities) {
    if ($p -match $Priority) {
        $content = $content -replace "- \[ \] $p", "- [x] $p"
    }
}

# Set date
$today = Get-Date -Format "yyyy-MM-dd"
$content = $content -replace "Started: YYYY-MM-DD", "Started: $today"

Set-Content -Path $ticketFile -Value $content
Write-Host "   Created: $ticketFile" -ForegroundColor Green

# Step 2: Create Git worktree (optional)
if ($CreateWorktree) {
    Write-Host "`n2. Creating Git worktree..." -ForegroundColor Green

    Set-Location $rootPath

    # Check if branch exists
    $branchExists = git branch -a | Select-String $branchName
    if ($branchExists) {
        Write-Host "   Branch $branchName already exists" -ForegroundColor Yellow
        Write-Host "   Creating worktree from existing branch..." -ForegroundColor Yellow
        git worktree add $worktreePath $branchName
    } else {
        Write-Host "   Creating new branch: $branchName" -ForegroundColor Green
        git worktree add $worktreePath -b $branchName
    }

    # Step 3: Setup worktree environment
    Write-Host "`n3. Setting up worktree environment..." -ForegroundColor Green
    Set-Location $worktreePath

    # Install dependencies if package.json exists
    if (Test-Path "package.json") {
        Write-Host "   Installing npm dependencies..." -ForegroundColor Green
        npm install --silent
    }

    # Copy environment files if they exist
    $envFile = Join-Path $rootPath ".env"
    if (Test-Path $envFile) {
        Write-Host "   Copying .env file..." -ForegroundColor Green
        Copy-Item $envFile -Destination $worktreePath
    }

    $envLocalFile = Join-Path $rootPath ".env.local"
    if (Test-Path $envLocalFile) {
        Write-Host "   Copying .env.local file..." -ForegroundColor Green
        Copy-Item $envLocalFile -Destination $worktreePath
    }
}

# Step 4: Summary
Write-Host "`n=== Ticket Created Successfully ===" -ForegroundColor Cyan
Write-Host "Ticket:    $ticketName" -ForegroundColor White
Write-Host "Type:      $Type" -ForegroundColor White
Write-Host "Priority:  $Priority" -ForegroundColor White
Write-Host "File:      $ticketFile" -ForegroundColor White

if ($CreateWorktree) {
    Write-Host "Branch:    $branchName" -ForegroundColor White
    Write-Host "Worktree:  $worktreePath" -ForegroundColor White
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Edit ticket: notepad $ticketFile" -ForegroundColor Yellow
if ($CreateWorktree) {
    Write-Host "2. Start work: cd $worktreePath" -ForegroundColor Yellow
    Write-Host "3. Run dev server: npm run dev" -ForegroundColor Yellow
}

# Open in VS Code if requested
if ($OpenInVSCode -and $CreateWorktree) {
    Write-Host "`nOpening in VS Code..." -ForegroundColor Green
    code $worktreePath
}

Write-Host "`nDone!" -ForegroundColor Green