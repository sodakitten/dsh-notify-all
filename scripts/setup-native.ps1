# One-time GUI launcher + independent Toast identity setup. No PowerShell identity is changed.
param([string]$Payload = '')
$ErrorActionPreference = 'Stop'
$cfg = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
$source = Join-Path $PSScriptRoot 'activate.cs'
$sourceId = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
$launcher = Join-Path $cfg.dir ('activate-0.2.1-' + $sourceId + '.exe')
if (-not (Test-Path -LiteralPath $launcher)) {
  Add-Type -Path $source -ReferencedAssemblies 'System.dll','System.Drawing.dll' -OutputAssembly $launcher -OutputType WindowsApplication
}
[void][Reflection.Assembly]::LoadFrom($launcher)
$programs = [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs)
$shortcut = Join-Path $programs 'DeepSeek Harness Notifications.lnk'
$uri = 'dsh-notify-all://open?key=' + $cfg.key
[DshNotifyActivation.ShellIntegration]::Register($cfg.appId, $launcher, $cfg.exePath, (Join-Path $cfg.dir 'dsh.png'), $uri, $shortcut)
& (Join-Path $PSScriptRoot 'register-protocol.ps1') -Scheme 'dsh-notify-all' -Command ('"' + $launcher + '" "%1"')
if ($LASTEXITCODE -ne 0) { throw 'Protocol registration failed' }
[IO.File]::WriteAllText((Join-Path $cfg.dir 'native-identity.json'), (@{appId=$cfg.appId; launcher=$launcher; icon=(Join-Path $cfg.dir 'dsh.png'); shortcut=$shortcut} | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
