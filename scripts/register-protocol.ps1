# dsh-notify-all :: register the toast-click protocol (user scope, no admin needed).
#
# The plugin's toasts use `activationType="protocol"`, so the target URI must have a
# handler. Writing HKCU\Software\Classes\<scheme> is the standard per-user way and needs
# no elevation. register-protocol.ps1 -Remove deletes it again.
#
# ASCII-only by design: the command line arrives as an argument.
param(
  [Parameter(Mandatory = $true)][string]$Scheme,
  [string]$Command = "",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$root = "HKCU:\Software\Classes\$Scheme"

try {
  if ($Remove) {
    if (Test-Path $root) { Remove-Item $root -Recurse -Force }
    exit 0
  }
  if ($Command -eq "") {
    [Console]::Error.WriteLine("dsh-notify-all protocol: -Command is required")
    exit 1
  }
  New-Item -Path $root -Force | Out-Null
  Set-ItemProperty -Path $root -Name "(default)" -Value "URL:$Scheme"
  # The shell only treats the key as a protocol handler when this named value exists.
  New-ItemProperty -Path $root -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
  New-Item -Path "$root\shell\open\command" -Force | Out-Null
  Set-ItemProperty -Path "$root\shell\open\command" -Name "(default)" -Value $Command
  Write-Output "registered $Scheme -> $Command"
  exit 0
} catch {
  [Console]::Error.WriteLine("dsh-notify-all protocol: " + $_.Exception.Message)
  exit 1
}
