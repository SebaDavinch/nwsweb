<#
Requests a vAMSYS OAuth token using client_credentials and writes it to the target .env.
Usage examples:
  # Interactive prompt for credentials
  pwsh ./scripts/save-vamsys-token.ps1 -TargetEnvPath /var/www/html/nwsweb/.env

  # Pass credentials on the command line (beware shell history)
  pwsh ./scripts/save-vamsys-token.ps1 -ClientId 552 -ClientSecret PCDjuKvgIbOXx1qSfsFMDFlBqq1ZJaOeXaiTpWvt -TargetEnvPath /var/www/html/nwsweb/.env

This script:
- POSTs to https://vamsys.io/oauth/token (grant_type=client_credentials)
- Extracts access_token from the JSON response
- Backs up the target .env to .env.bak.TIMESTAMP
- Updates or appends VAMSYS_API_TOKEN and VAMSYS_API_AUTH_SCHEME=Bearer
- Optionally restarts systemd service `nwsweb-api.service` (Linux)
#>
param(
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$TokenUrl = 'https://vamsys.io/oauth/token',
    [string]$TargetEnvPath = '/var/www/html/nwsweb/.env',
    [switch]$RestartService
n)

function Read-Secret($prompt) {
    if ($Host.UI.SupportsVirtualTerminal) {
        Write-Host -NoNewline "$prompt: " -ForegroundColor Yellow
        $sec = Read-Host -AsSecureString
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    }
    else {
        return Read-Host $prompt
    }
}

if (-not $ClientId) { $ClientId = Read-Host 'VAMSYS_CLIENT_ID' }
if (-not $ClientSecret) { $ClientSecret = Read-Secret 'VAMSYS_CLIENT_SECRET' }

if (-not $ClientId -or -not $ClientSecret) {
    Write-Error 'ClientId and ClientSecret are required.'
    exit 2
}

Write-Host "Requesting token from $TokenUrl" -ForegroundColor Cyan
try {
    $body = @{ grant_type = 'client_credentials'; client_id = $ClientId; client_secret = $ClientSecret }
    $resp = Invoke-RestMethod -Method Post -Uri $TokenUrl -Body $body -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
}
catch {
    Write-Error "Token request failed: $($_.Exception.Message)"
    exit 3
}

<#
Requests a vAMSYS OAuth token using client_credentials and writes it to the target .env.
Usage examples:
  # Interactive prompt for credentials
  pwsh ./scripts/save-vamsys-token.ps1 -TargetEnvPath /var/www/html/nwsweb/.env

  # Pass credentials on the command line (beware shell history)
  pwsh ./scripts/save-vamsys-token.ps1 -ClientId 552 -ClientSecret PCDjuKvgIbOXx1qSfsFMDFlBqq1ZJaOeXaiTpWvt -TargetEnvPath /var/www/html/nwsweb/.env

This script:
- POSTs to https://vamsys.io/oauth/token (grant_type=client_credentials)
- Extracts access_token from the JSON response
- Backs up the target .env to .env.bak.TIMESTAMP
- Updates or appends VAMSYS_API_TOKEN and VAMSYS_API_AUTH_SCHEME=Bearer
- Optionally restarts systemd service `nwsweb-api.service` (Linux)
#>
param(
    [string]$ClientId,
    [string]$ClientSecret,
    [string]$TokenUrl = 'https://vamsys.io/oauth/token',
    [string]$TargetEnvPath = '/var/www/html/nwsweb/.env',
    [switch]$RestartService
)

function Read-Secret($prompt) {
    if ($Host.UI.SupportsVirtualTerminal) {
        Write-Host -NoNewline "$prompt: " -ForegroundColor Yellow
        $sec = Read-Host -AsSecureString
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    }
    else {
        return Read-Host $prompt
    }
}

if (-not $ClientId) { $ClientId = Read-Host 'VAMSYS_CLIENT_ID' }
if (-not $ClientSecret) { $ClientSecret = Read-Secret 'VAMSYS_CLIENT_SECRET' }

if (-not $ClientId -or -not $ClientSecret) {
    Write-Error 'ClientId and ClientSecret are required.'
    exit 2
}

Write-Host "Requesting token from $TokenUrl" -ForegroundColor Cyan
try {
    $body = @{ grant_type = 'client_credentials'; client_id = $ClientId; client_secret = $ClientSecret }
    $resp = Invoke-RestMethod -Method Post -Uri $TokenUrl -Body $body -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
}
catch {
    Write-Error "Token request failed: $($_.Exception.Message)"
    exit 3
}

$token = $resp.access_token
if (-not $token) {
    Write-Error "Token response did not include access_token. Full response:`n$($resp | ConvertTo-Json -Depth 5)"
    exit 4
}

Write-Host "Received token (length: $($token.Length)). Updating $TargetEnvPath" -ForegroundColor Green

# Ensure target path exists; if not, create parent dir placeholder message
$parent = Split-Path $TargetEnvPath -Parent
if (-not (Test-Path $parent)) {
    Write-Warning "$parent does not exist. Create it or run this script on the target machine." 
}

# Backup existing env
if (Test-Path $TargetEnvPath) {
    $bak = "$TargetEnvPath.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
    Copy-Item -Force -Path $TargetEnvPath -Destination $bak
    Write-Host "Backed up existing env to $bak" -ForegroundColor Yellow
}
else {
    New-Item -Force -ItemType File -Path $TargetEnvPath | Out-Null
    Write-Host "Created new env file at $TargetEnvPath" -ForegroundColor Yellow
}

# Read, update or append variables
$lines = Get-Content $TargetEnvPath -Raw -ErrorAction SilentlyContinue -Encoding UTF8
if ($null -eq $lines) { $lines = "" }

# Prepare replacements
$patToken = '^(VAMSYS_API_TOKEN)=.*$'
$patScheme = '^(VAMSYS_API_AUTH_SCHEME)=.*$'

if ($lines -match "(?m)$patToken") {
    $lines = $lines -replace "(?m)$patToken", "`$1=$token"
}
else {
    $lines += "`nVAMSYS_API_TOKEN=$token"
}

if ($lines -match "(?m)$patScheme") {
    $lines = $lines -replace "(?m)$patScheme", "`$1=Bearer"
}
else {
    $lines += "`nVAMSYS_API_AUTH_SCHEME=Bearer"
}

# Write updated env
Set-Content -Path $TargetEnvPath -Value $lines -Encoding UTF8
Write-Host "Updated $TargetEnvPath" -ForegroundColor Green

if ($RestartService.IsPresent) {
    if ($IsLinux) {
        Write-Host 'Restarting systemd service nwsweb-api.service' -ForegroundColor Cyan
        try {
            sudo systemctl restart nwsweb-api.service
            Write-Host 'Service restarted.' -ForegroundColor Green
        }
        catch {
            Write-Warning "Failed to restart service via systemctl. You may need to run sudo systemctl restart nwsweb-api.service manually. Error: $_"
        }
    }
    else {
        Write-Warning 'Service restart requested but this platform is not recognized as Linux; restart the Node service manually.'
    }
}

Write-Host 'Done.' -ForegroundColor Cyan
