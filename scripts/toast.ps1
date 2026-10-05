# dsh-notify-all :: WinRT toast notifier (Windows 10/11, PowerShell 5.1 compatible).
# Payload: base64(UTF8 JSON) = { title, body, url, sound }. ASCII-only file by design:
# all user-visible text arrives via the JSON payload to avoid PS 5.1 encoding pitfalls.
param([string]$Payload = "")

$ErrorActionPreference = "Stop"

function Fail([string]$message) {
  [Console]::Error.WriteLine("dsh-notify-all toast: " + $message)
  exit 1
}

if ($Payload -eq "") { Fail "missing -Payload" }

try {
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload))
  $data = $json | ConvertFrom-Json
} catch {
  Fail ("bad payload: " + $_.Exception.Message)
}

$title = [string]$data.title
$body = [string]$data.body
$url = [string]$data.url
$sound = ($data.sound -eq $true)

if ($title -eq "") { $title = "DeepSeek Harness" }

try {
  # Load the WinRT projections (works in Windows PowerShell 5.1).
  [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
  [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
  [void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
} catch {
  Fail ("WinRT unavailable: " + $_.Exception.Message)
}

function Escape-Xml([string]$value) {
  if ($null -eq $value) { return "" }
  return $value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;")
}

$launchAttributes = ""
if ($url -ne "") {
  $launchAttributes = ' activationType="protocol" launch="' + (Escape-Xml $url) + '"'
}

$audioElement = '<audio src="ms-winsoundevent:Notification.Default"/>'
if (-not $sound) { $audioElement = '<audio silent="true"/>' }
$logoElement = ''
if ($data.iconPath -and (Test-Path -LiteralPath $data.iconPath)) {
  $logoUri = (New-Object Uri([string]$data.iconPath)).AbsoluteUri
  $logoElement = '<image placement="appLogoOverride" src="' + (Escape-Xml $logoUri) + '"/>'
}

$toastXml = '<toast' + $launchAttributes + '>' +
  '<visual><binding template="ToastGeneric">' +
  $logoElement +
  '<text>' + (Escape-Xml $title) + '</text>' +
  '<text>' + (Escape-Xml $body) + '</text>' +
  '</binding></visual>' +
  $audioElement +
  '</toast>'

# Independent identity registered by setup-native.ps1; never borrows PowerShell's AUMID.
$appId = [string]$data.appId
if ($appId -notlike 'DeepSeekHarness.NotifyAll*') { Fail 'invalid notification identity' }

try {
  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml($toastXml)
  $toast = New-Object Windows.UI.Notifications.ToastNotification($xml)
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
  exit 0
} catch {
  Fail ("show failed: " + $_.Exception.Message)
}
