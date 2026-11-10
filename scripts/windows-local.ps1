param([Parameter(Mandatory = $true)][ValidateSet('Setup', 'Run')][string]$Mode)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([string]$Command, [string[]]$CommandArguments)
    & $Command @CommandArguments
    if ($LASTEXITCODE -ne 0) { throw "Lenh $Command khong thanh cong. Xem loi o tren." }
}

function Test-BookMarket {
    param([string]$Url, [string]$Pattern)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match $Pattern
    } catch { return $false }
}

function Start-BookMarketServer {
    param([int]$Port, [string]$Url, [string]$Pattern, [string]$Command)
    if (Test-BookMarket $Url $Pattern) {
        Write-Host "Dang chay: $Url"
        return
    }
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
        throw "Cong $Port dang duoc ung dung khac su dung. Hay dong ung dung do roi chay lai."
    }
    # Hai cua so hien log de nguoi dung xem loi va dung server bang Ctrl+C.
    Start-Process -FilePath 'cmd.exe' -WorkingDirectory $projectRoot -ArgumentList ('/d /k "' + $Command + '"') | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Test-BookMarket $Url $Pattern) { Write-Host "Da khoi dong: $Url"; return }
        Start-Sleep -Seconds 1
    }
    throw "Chua khoi dong duoc cong $Port. Xem cua so server vua mo de biet loi."
}

try {
    Set-Location -LiteralPath $projectRoot
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'Hay cai Node.js 20.19 tro len, sau do mo lai file BAT.'
    }
    $version = (& node.exe -p 'process.versions.node').Trim().Split('.')
    if ([int]$version[0] -lt 20 -or ([int]$version[0] -eq 20 -and [int]$version[1] -lt 19)) {
        throw 'Project can Node.js 20.19 tro len.'
    }
    if ($Mode -eq 'Setup') {
        Write-Host '[1/4] Cai thu vien frontend va backend...'
        Invoke-Checked 'npm.cmd' @('run', 'setup')
        Write-Host '[2/4] Tao cau hinh local, giu nguyen .env da co...'
        Invoke-Checked 'node.exe' @('scripts/setup-env.mjs')
    } elseif (-not (Test-Path -LiteralPath 'backend/.env') -or -not (Test-Path -LiteralPath 'backend/node_modules/mongoose') -or -not (Test-Path -LiteralPath 'frontend/node_modules/vite')) {
        throw 'Hay chay setup.bat truoc.'
    }

    $configuration = & node.exe 'backend/scripts/setup-local-database.mjs' 'config'
    if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc cau hinh. Xem backend/.env.' }
    $configuration = $configuration | ConvertFrom-Json
    if ($configuration.startLocalMongo) {
        Write-Host 'Khoi dong MongoDB replica set local...'
        & (Join-Path $PSScriptRoot 'start-mongo-replica.ps1')
    }
    if ($Mode -eq 'Setup') {
        Write-Host '[3/4] Chuan bi database...'
        Invoke-Checked 'node.exe' @('backend/scripts/setup-local-database.mjs', 'setup')
        Write-Host '[4/4] Cai dat xong. Bam run.bat de mo ung dung.' -ForegroundColor Green
    } else {
        Invoke-Checked 'node.exe' @('backend/scripts/setup-local-database.mjs', 'check')
        $apiPort = [int]$configuration.port
        Start-BookMarketServer $apiPort "http://127.0.0.1:$apiPort/health" 'BookMarket API' 'npm run dev:api'
        # Thanh toan SePay gui webhook den Render, nen frontend local cung phai tao
        # don tren backend Render/Atlas de giao dich duoc tu dong doi soat va cap ebook.
        $env:API_PROXY_TARGET = 'https://bookmarket-api-ngvquan.onrender.com'
        # Goi truc tiep script frontend de npm khong lam mat dau "--" khi truyen tham so cho Vite.
        Start-BookMarketServer 5173 'http://127.0.0.1:5173/' '(?i)bookmarket' 'npm --prefix frontend run dev -- --port 5173 --strictPort'
        Write-Host 'Mo trinh duyet: http://localhost:5173' -ForegroundColor Green
        Write-Host 'Dung frontend/backend bang Ctrl+C trong tung cua so server. MongoDB tiep tuc chay nen.'
    }
} catch {
    Write-Host ("LOI: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'May can cai Node.js va MongoDB Community Server (chi Compass la chua du).'
    exit 1
}
