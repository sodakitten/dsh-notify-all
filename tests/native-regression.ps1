# Quiet native worker integration: never draws on the real taskbar or sends toasts.
$ErrorActionPreference = 'Stop'
$testDir = Join-Path $env:TEMP ('dsh-native-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
$scriptPath = Join-Path $PSScriptRoot '..\scripts\tray.ps1'
function Write-State($count, $color, $exit) {
  $state = @{count=$count; color=$color; exit=$exit; trayIcon=$false; url=''} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText((Join-Path $testDir 'badge.json'), $state, (New-Object Text.UTF8Encoding($false)))
}
function Await-State($count) {
  for ($n=0; $n -lt 80; $n++) {
    Start-Sleep -Milliseconds 100
    try {
      $v = Get-Content -LiteralPath (Join-Path $testDir 'native-status.json') -Raw | ConvertFrom-Json
      if ($v.count -eq $count) { return $v }
    } catch {}
  }
  throw "Worker did not publish count=$count"
}
$proc = $null
try {
  Write-State 3 '#E62B34' $false
  $payload = @{dir=$testDir; watchPid=$PID; mutex=('dsh-native-test-' + [Guid]::NewGuid()); overlay=$false; trayIcon=$false}
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress)))
  $proc = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @('-STA','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$scriptPath+'"'),'-Payload',$b64)
  $value = Await-State 3
  if ($value.hresult -ne 0) { throw ('COM init failed: ' + $value.hresult) }
  Write-Output ('PASS COM initialized through ' + $value.via + ' with a desktop window handle')
  Write-State 120 '#1A1A1A' $false
  $value = Await-State 120
  if ($value.color -ne '#1A1A1A') { throw 'Color did not update' }
  Write-Output 'PASS worker state updates: count=120, black color'
  $bytes = [IO.File]::ReadAllBytes((Join-Path $testDir 'native-status.json'))
  if ($bytes[0] -ne 123) { throw 'Worker JSON has a BOM' }
  Write-Output 'PASS native state JSON has no BOM'
  Write-State 0 '#E62B34' $false
  [void](Await-State 0)
  Write-Output 'PASS count zero updates without drawing a taskbar badge'
  Write-State 0 '#E62B34' $true
  if (-not $proc.WaitForExit(5000)) { throw 'Worker did not exit cleanly' }
  if ($proc.ExitCode -ne 0) { throw ('Worker exit ' + $proc.ExitCode) }
  Write-Output 'PASS worker exits and releases resources'
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  $resolved = (Resolve-Path -LiteralPath $testDir).Path
  if ($resolved.StartsWith([IO.Path]::GetFullPath($env:TEMP) + '\')) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
