# Start local AI and voice services for the Android app on the same Wi-Fi.
$projectRoot = Split-Path -Parent $PSScriptRoot
$voicePython = 'E:\BookMarket\voice-env\Scripts\python.exe'
$voiceScript = Join-Path $projectRoot 'backend\scripts\voice-server.py'
$backendDir = Join-Path $projectRoot 'backend'

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

if (-not (Test-Port 4000)) {
    Start-Process -FilePath 'node.exe' -ArgumentList 'src/server.js' -WorkingDirectory $backendDir -WindowStyle Hidden
    Write-Host 'Started local AI API on port 4000.'
} else {
    Write-Host 'Local AI API is already listening on port 4000.'
}

if (-not (Test-Port 4001)) {
    if (-not (Test-Path -LiteralPath $voicePython)) {
        throw "Voice Python environment not found: $voicePython"
    }
    $env:VOICE_HOST = '0.0.0.0'
    Start-Process -FilePath $voicePython -ArgumentList $voiceScript -WorkingDirectory $projectRoot -WindowStyle Hidden
    Write-Host 'Started voice recognition on port 4001.'
} else {
    Write-Host 'Voice recognition is already listening on port 4001.'
}

Write-Host 'Use the same Wi-Fi on the phone. If this computer LAN IP changes, update frontend/.env.mobile and rebuild the APK.'
