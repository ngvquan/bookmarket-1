param([string]$MongodPath = '')
$ErrorActionPreference = 'Stop'
# Replica set local một node phục vụ transaction khi học/thử, dùng cổng riêng.
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $projectRoot '.local\mongo-rs'
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
if (-not (Get-NetTCPConnection -State Listen -LocalPort 27018 -ErrorAction SilentlyContinue)) {
    if (-not $MongodPath) {
        $command = Get-Command mongod -ErrorAction SilentlyContinue
        if ($command) { $MongodPath = $command.Source }
    }
    if (-not $MongodPath) {
        $service = Get-CimInstance Win32_Service | Where-Object { $_.Name -eq 'MongoDB' } | Select-Object -First 1
        if ($service.PathName -match '^"([^"]+mongod.exe)"|^(.+?mongod.exe)') {
            $MongodPath = if ($Matches[1]) { $Matches[1] } else { $Matches[2] }
        }
    }
    if (-not $MongodPath -or -not (Test-Path -LiteralPath $MongodPath)) {
        throw 'Khong tim thay mongod.exe. Chay lai voi -MongodPath duong-dan-mongod.exe.'
    }
    $logPath = Join-Path $dataPath 'mongod.log'
    $arguments = @('--replSet', 'bookmarket-rs', '--port', '27018', '--bind_ip', '127.0.0.1', '--dbpath', ('"' + $dataPath + '"'), '--logpath', ('"' + $logPath + '"'), '--logappend')
    Start-Process -FilePath $MongodPath -ArgumentList $arguments -WindowStyle Hidden | Out-Null
}
node (Join-Path $projectRoot 'backend\scripts\init-mongo-replica.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Khong khoi tao duoc replica set local.' }
