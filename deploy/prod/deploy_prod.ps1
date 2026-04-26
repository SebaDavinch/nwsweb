param(
  [string]$RemoteHost = $(if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { 'your.server.example' }),
  [string]$RemoteUser = $(if ($env:REMOTE_USER) { $env:REMOTE_USER } else { 'deploy' }),
  [string]$RemoteDir = $(if ($env:REMOTE_DIR) { $env:REMOTE_DIR } else { '/var/www/nws' }),
  [string]$ApiService = $(if ($env:API_SERVICE) { $env:API_SERVICE } else { 'nwsweb-api' }),
  [string]$SiteService = $(if ($env:SITE_SERVICE) { $env:SITE_SERVICE } else { 'nwsweb-site' }),
  [string]$NginxService = $(if ($env:NGINX_SERVICE) { $env:NGINX_SERVICE } else { 'nginx' }),
  [switch]$SkipBuild,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Require-Command {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Required command '$Name' was not found in PATH."
  }

  return $command.Source
}

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host "==> $Label"
  & $Action
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  if ($DryRun) {
    $joinedArgs = $Arguments -join ' '
    Write-Host "[dry-run] $FilePath $joinedArgs"
    return
  }

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$remoteTarget = "${RemoteUser}@${RemoteHost}"

if ($RemoteHost -eq 'your.server.example') {
  throw 'RemoteHost is still set to the placeholder value. Pass -RemoteHost or set REMOTE_HOST.'
}

$null = Require-Command 'npm'
$sshPath = Require-Command 'ssh'
$scpPath = Require-Command 'scp'

Push-Location $repoRoot
try {
  if (-not (Test-Path 'package.json')) {
    throw 'package.json not found. Run this script from the repository checkout.'
  }

  if (-not (Test-Path '.env')) {
    throw '.env not found in the repository root. Deployment expects the production environment file.'
  }

  if (-not $SkipBuild) {
    Invoke-Step 'Building frontend' {
      Invoke-External -FilePath 'npm' -Arguments @('run', 'build')
    }
  }

  if (-not (Test-Path 'dist')) {
    throw 'dist directory not found. Run the build first or omit -SkipBuild.'
  }

  $remotePrepareCommand = @(
    "set -euo pipefail",
    "mkdir -p '$RemoteDir' '$RemoteDir/deploy'",
    "rm -rf '$RemoteDir/dist' '$RemoteDir/server' '$RemoteDir/deploy/prod'",
    "mkdir -p '$RemoteDir/dist' '$RemoteDir/server' '$RemoteDir/deploy'"
  ) -join '; '

  Invoke-Step 'Preparing remote directories' {
    Invoke-External -FilePath $sshPath -Arguments @($remoteTarget, $remotePrepareCommand)
  }

  Invoke-Step 'Uploading dist' {
    Invoke-External -FilePath $scpPath -Arguments @('-r', 'dist', "${remoteTarget}:$RemoteDir/")
  }

  Invoke-Step 'Uploading server' {
    Invoke-External -FilePath $scpPath -Arguments @('-r', 'server', "${remoteTarget}:$RemoteDir/")
  }

  Invoke-Step 'Uploading deploy config' {
    Invoke-External -FilePath $scpPath -Arguments @('-r', 'deploy/prod', "${remoteTarget}:$RemoteDir/deploy/")
  }

  Invoke-Step 'Uploading package manifests' {
    Invoke-External -FilePath $scpPath -Arguments @('package.json', 'package-lock.json', "${remoteTarget}:$RemoteDir/")
  }

  Invoke-Step 'Uploading environment file' {
    Invoke-External -FilePath $scpPath -Arguments @('.env', "${remoteTarget}:$RemoteDir/.env")
  }

  $remoteFinalizeCommand = @(
    "set -euo pipefail",
    "sudo mkdir -p '$RemoteDir/data'",
    "sudo chown -R www-data:www-data '$RemoteDir/data'",
    "cd '$RemoteDir'",
    "npm ci --omit=dev",
    "sudo systemctl daemon-reload",
    "sudo systemctl restart '$ApiService' '$SiteService'",
    "sudo systemctl reload '$NginxService'"
  ) -join '; '

  Invoke-Step 'Installing production dependencies and restarting services' {
    Invoke-External -FilePath $sshPath -Arguments @($remoteTarget, $remoteFinalizeCommand)
  }

  Write-Host 'Done.'
}
finally {
  Pop-Location
}