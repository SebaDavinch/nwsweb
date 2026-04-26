$pids = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($pids) {
  foreach ($owningPid in $pids) {
    Write-Output "Killing PID $owningPid"
    Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
  }
} else {
  Write-Output "No process found on port 8787"
}
