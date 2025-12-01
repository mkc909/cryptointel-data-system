# Ticket Status Dashboard Script
# Usage: .\ticket-status.ps1 [-ShowCompleted] [-ShowWorktrees] [-Detailed]

param(
    [Parameter(Mandatory=$false)]
    [switch]$ShowCompleted = $false,

    [Parameter(Mandatory=$false)]
    [switch]$ShowWorktrees = $true,

    [Parameter(Mandatory=$false)]
    [switch]$Detailed = $false,

    [Parameter(Mandatory=$false)]
    [string]$TicketNumber = ""
)

$ErrorActionPreference = "Stop"

# Paths
$rootPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ticketsPath = Join-Path $rootPath ".tickets"
$activePath = Join-Path $ticketsPath "active"
$completedPath = Join-Path $ticketsPath "completed"
$worktreesPath = Join-Path $ticketsPath "worktrees"

# Colors for output
function Write-Status($status) {
    switch ($status) {
        "Active"     { Write-Host $status -ForegroundColor Green -NoNewline }
        "Completed"  { Write-Host $status -ForegroundColor Cyan -NoNewline }
        "In Progress" { Write-Host $status -ForegroundColor Yellow -NoNewline }
        default      { Write-Host $status -NoNewline }
    }
}

Write-Host "`n==================================" -ForegroundColor Blue
Write-Host "     TICKET STATUS DASHBOARD      " -ForegroundColor Blue
Write-Host "==================================" -ForegroundColor Blue

# Get worktree information
Set-Location $rootPath
$worktreeList = @{}
$worktreeOutput = git worktree list 2>$null

if ($worktreeOutput) {
    foreach ($line in $worktreeOutput) {
        if ($line -match "TICKET-(\d+)") {
            $ticketNum = $Matches[1]
            $parts = $line -split "\s+"
            $worktreeBranch = $parts[-1]

            # Get worktree status
            $worktreePath = Join-Path $worktreesPath "TICKET-$ticketNum"
            if (Test-Path $worktreePath) {
                Set-Location $worktreePath
                $changes = git status --porcelain 2>$null
                $worktreeList[$ticketNum] = @{
                    Branch = $worktreeBranch
                    Path = $worktreePath
                    HasChanges = $changes.Count -gt 0
                    Changes = $changes.Count
                }
            }
        }
    }
}

Set-Location $rootPath

# Function to parse ticket file
function Get-TicketInfo($file) {
    $content = Get-Content $file.FullName -Raw
    $info = @{
        Name = $file.BaseName
        Number = ""
        Type = "unknown"
        Priority = "P2"
        Status = @()
        Description = ""
    }

    # Extract ticket number
    if ($file.Name -match "TICKET-(\d+)") {
        $info.Number = $Matches[1]
    }

    # Parse content
    $lines = $content -split "`n"
    foreach ($line in $lines) {
        # Get type
        if ($line -match "^## Type`r?$") {
            $nextLine = $lines[$lines.IndexOf($line) + 1]
            if ($nextLine) {
                $info.Type = $nextLine.Trim()
            }
        }

        # Get priority
        if ($line -match "- \[x\] .* \((P\d)\)") {
            $info.Priority = $Matches[1]
        }

        # Get status checkboxes
        if ($line -match "^- \[([ x])\] (.+)$") {
            $checked = $Matches[1] -eq "x"
            $statusItem = $Matches[2]
            if ($statusItem -match "^(In Progress|Code Complete|Tested|Reviewed|Merged)") {
                if ($checked) {
                    $info.Status += $statusItem
                }
            }
        }

        # Get description (first line after title)
        if ($line -match "^## Description") {
            $nextLine = $lines[$lines.IndexOf($line) + 1]
            if ($nextLine) {
                $info.Description = $nextLine.Trim()
                if ($info.Description.Length -gt 50) {
                    $info.Description = $info.Description.Substring(0, 47) + "..."
                }
            }
        }
    }

    return $info
}

# Display active tickets
Write-Host "`n📋 ACTIVE TICKETS" -ForegroundColor Yellow
Write-Host "─────────────────" -ForegroundColor Gray

$activeTickets = Get-ChildItem $activePath -Filter "TICKET-*.md" 2>$null | Sort-Object Name

if ($activeTickets.Count -eq 0) {
    Write-Host "No active tickets found." -ForegroundColor Gray
} else {
    foreach ($ticket in $activeTickets) {
        $info = Get-TicketInfo $ticket

        # Filter by ticket number if specified
        if ($TicketNumber -and $info.Number -ne $TicketNumber) {
            continue
        }

        # Basic info
        Write-Host "`n  " -NoNewline
        Write-Host "[$($info.Priority)]" -ForegroundColor $(
            switch($info.Priority) {
                "P0" { "Red" }
                "P1" { "Magenta" }
                "P2" { "Yellow" }
                "P3" { "Gray" }
            }
        ) -NoNewline
        Write-Host " TICKET-$($info.Number)" -ForegroundColor White -NoNewline
        Write-Host " ($($info.Type))" -ForegroundColor DarkGray

        # Description
        if ($info.Description) {
            Write-Host "      $($info.Description)" -ForegroundColor Gray
        }

        # Status
        if ($info.Status.Count -gt 0) {
            $latestStatus = $info.Status[-1]
            Write-Host "      Status: " -NoNewline
            Write-Status $latestStatus
            Write-Host ""
        }

        # Worktree info
        if ($ShowWorktrees -and $worktreeList.ContainsKey($info.Number)) {
            $wt = $worktreeList[$info.Number]
            Write-Host "      Worktree: " -NoNewline
            Write-Host "$($wt.Branch)" -ForegroundColor Cyan -NoNewline
            if ($wt.HasChanges) {
                Write-Host " [$($wt.Changes) uncommitted changes]" -ForegroundColor Yellow
            } else {
                Write-Host " [clean]" -ForegroundColor Green
            }
        }

        # Detailed view
        if ($Detailed) {
            Write-Host "      Progress:" -ForegroundColor DarkGray
            foreach ($status in @("In Progress", "Code Complete", "Tested", "Reviewed", "Merged")) {
                $hasStatus = $info.Status -contains $status
                $symbol = if ($hasStatus) { "✓" } else { "○" }
                $color = if ($hasStatus) { "Green" } else { "DarkGray" }
                Write-Host "        $symbol $status" -ForegroundColor $color
            }
        }
    }

    Write-Host "`n  Total Active: $($activeTickets.Count)" -ForegroundColor White
}

# Display completed tickets (optional)
if ($ShowCompleted) {
    Write-Host "`n✅ COMPLETED TICKETS" -ForegroundColor Cyan
    Write-Host "───────────────────" -ForegroundColor Gray

    $completedTickets = @()
    $monthDirs = Get-ChildItem $completedPath -Directory | Sort-Object Name -Descending | Select-Object -First 3

    foreach ($monthDir in $monthDirs) {
        $tickets = Get-ChildItem $monthDir.FullName -Filter "TICKET-*.md" 2>$null
        foreach ($ticket in $tickets) {
            $completedTickets += @{
                File = $ticket
                Month = $monthDir.Name
            }
        }
    }

    if ($completedTickets.Count -eq 0) {
        Write-Host "No completed tickets found." -ForegroundColor Gray
    } else {
        foreach ($item in $completedTickets | Select-Object -First 10) {
            $info = Get-TicketInfo $item.File
            Write-Host "  " -NoNewline
            Write-Host "TICKET-$($info.Number)" -ForegroundColor DarkCyan -NoNewline
            Write-Host " ($($info.Type))" -ForegroundColor DarkGray -NoNewline
            Write-Host " - $($item.Month)" -ForegroundColor DarkGray
            if ($info.Description) {
                Write-Host "    $($info.Description)" -ForegroundColor DarkGray
            }
        }

        Write-Host "`n  Total Shown: $($completedTickets.Count) (last 3 months)" -ForegroundColor DarkCyan
    }
}

# Display worktree summary
if ($ShowWorktrees) {
    Write-Host "`n🌳 WORKTREES" -ForegroundColor Magenta
    Write-Host "───────────" -ForegroundColor Gray

    if ($worktreeList.Count -eq 0) {
        Write-Host "No worktrees active." -ForegroundColor Gray
    } else {
        foreach ($ticketNum in $worktreeList.Keys | Sort-Object) {
            $wt = $worktreeList[$ticketNum]
            Write-Host "  TICKET-$ticketNum" -ForegroundColor White -NoNewline
            Write-Host " on " -NoNewline
            Write-Host "$($wt.Branch)" -ForegroundColor Cyan

            if ($wt.HasChanges) {
                Write-Host "    ⚠ $($wt.Changes) uncommitted changes" -ForegroundColor Yellow
            }

            if ($Detailed) {
                # Show recent commits
                Set-Location $wt.Path
                $recentCommits = git log --oneline -n 3 2>$null
                if ($recentCommits) {
                    Write-Host "    Recent commits:" -ForegroundColor DarkGray
                    foreach ($commit in $recentCommits) {
                        Write-Host "      $commit" -ForegroundColor DarkGray
                    }
                }
            }
        }

        Write-Host "`n  Total Worktrees: $($worktreeList.Count)" -ForegroundColor White
    }
}

# Summary statistics
Write-Host "`n📊 SUMMARY" -ForegroundColor Green
Write-Host "─────────" -ForegroundColor Gray

$stats = @{
    Active = $activeTickets.Count
    Worktrees = $worktreeList.Count
    P0 = ($activeTickets | ForEach-Object { Get-TicketInfo $_ } | Where-Object { $_.Priority -eq "P0" }).Count
    P1 = ($activeTickets | ForEach-Object { Get-TicketInfo $_ } | Where-Object { $_.Priority -eq "P1" }).Count
}

Write-Host "  Active Tickets:    $($stats.Active)" -ForegroundColor White
Write-Host "  Active Worktrees:  $($stats.Worktrees)" -ForegroundColor White

if ($stats.P0 -gt 0) {
    Write-Host "  Critical (P0):     $($stats.P0)" -ForegroundColor Red
}
if ($stats.P1 -gt 0) {
    Write-Host "  High Priority (P1): $($stats.P1)" -ForegroundColor Magenta
}

# Warnings
$warnings = @()

if ($stats.Active -gt $stats.Worktrees) {
    $warnings += "$(($stats.Active - $stats.Worktrees)) tickets without worktrees"
}

foreach ($ticketNum in $worktreeList.Keys) {
    $hasTicket = $activeTickets | Where-Object { $_.Name -match "TICKET-$ticketNum" }
    if (-not $hasTicket) {
        $warnings += "Worktree TICKET-$ticketNum has no active ticket"
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  WARNINGS" -ForegroundColor Yellow
    Write-Host "──────────" -ForegroundColor Gray
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
}

Write-Host "`n==================================" -ForegroundColor Blue
Set-Location $rootPath