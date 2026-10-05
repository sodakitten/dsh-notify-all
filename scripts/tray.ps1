# dsh-notify-all native badge worker. ASCII only; Windows PowerShell 5.1.
param([string]$Payload = "")
$ErrorActionPreference = "Stop"
try { $cfg = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json }
catch { [Console]::Error.WriteLine("invalid payload"); exit 1 }
$script:stateDir = [string]$cfg.dir
if (-not (Test-Path -LiteralPath $script:stateDir)) { exit 1 }
$script:watchPid = [int]$cfg.watchPid
$script:baseIconPath = [string]$cfg.exePath
$script:url = [string]$cfg.url
$script:count = -1
$script:color = "#E62B34"
$script:trayEnabled = $false
$script:hIcon = [IntPtr]::Zero
$script:lastHwnd = [IntPtr]::Zero
$script:lastOverlayAt = [DateTime]::MinValue
$script:lastStatus = ""
$script:overlayDraw = $cfg.overlay -ne $false
$stateFile = Join-Path $script:stateDir "badge.json"
$traceFile = Join-Path $script:stateDir "tray.log"
function Trace([string]$s) {
  try {
    if ((Get-Item -LiteralPath $traceFile -ErrorAction SilentlyContinue).Length -gt 512000) { [IO.File]::WriteAllText($traceFile, "") }
    Add-Content -LiteralPath $traceFile -Value ((Get-Date -Format o) + " " + $s) -Encoding UTF8
  } catch {}
}
$mutex = New-Object Threading.Mutex($false, [string]$cfg.mutex)
$acquired = $false
try { $acquired = $mutex.WaitOne(5000) } catch { $acquired = $true }
if (-not $acquired) { $mutex.Dispose(); exit 0 }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Text;

namespace DshTray {
    public static class Native {
        [DllImport("ole32.dll")]
        public static extern int CoCreateInstance(ref Guid clsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid riid, out IntPtr ppv);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        public delegate int HrInitDelegate(IntPtr self);

        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Unicode)]
        public delegate int SetOverlayIconDelegate(IntPtr self, IntPtr hwnd, IntPtr hIcon, [MarshalAs(UnmanagedType.LPWStr)] string description);

        public static readonly Guid ClsidTaskbarList = new Guid("56FDF344-FD6D-11d0-958A-006097C9A090");
        // Prefer ITaskbarList4 and fall back to the documented ITaskbarList3 GUID.
        public static readonly Guid IidITaskbarList4 = new Guid("C43DC798-95D1-4BEA-9030-BB99E2983A1A");
        public static readonly Guid IidITaskbarList3 = new Guid("EA1AFB91-9E28-4B86-90E9-9E9F8A5EEFAF");
        public const uint CLSCTX_INPROC_SERVER = 1;

        /// <summary>
        /// Creates the shell taskbar object and binds HrInit (vtable slot 3) and
        /// SetOverlayIcon (vtable slot 18). Returns the interface used, or null when
        /// the shell exposes no usable taskbar interface.
        /// </summary>
        public static string TryCreateTaskbar(out IntPtr com, out HrInitDelegate hrInit, out SetOverlayIconDelegate setOverlay) {
            com = IntPtr.Zero; hrInit = null; setOverlay = null;
            Guid clsid = ClsidTaskbarList;
            Guid iid4 = IidITaskbarList4;
            Guid iid3 = IidITaskbarList3;
            IntPtr ppv;
            string via = "ITaskbarList4";
            int hr = CoCreateInstance(ref clsid, IntPtr.Zero, CLSCTX_INPROC_SERVER, ref iid4, out ppv);
            if (hr != 0) {
                via = "ITaskbarList3";
                hr = CoCreateInstance(ref clsid, IntPtr.Zero, CLSCTX_INPROC_SERVER, ref iid3, out ppv);
            }
            if (hr != 0 || ppv == IntPtr.Zero) return null;
            com = ppv;
            IntPtr vtbl = Marshal.ReadIntPtr(com);
            hrInit = (HrInitDelegate)Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(vtbl, 3 * IntPtr.Size), typeof(HrInitDelegate));
            setOverlay = (SetOverlayIconDelegate)Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(vtbl, 18 * IntPtr.Size), typeof(SetOverlayIconDelegate));
            return via;
        }

        private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lp);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hwnd, int index);
        [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr hIcon);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);

        private const uint GW_OWNER = 4;
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x80;
        private const int DWMWA_CLOAKED = 14;

        public static IntPtr FindMainWindow(HashSet<uint> pids, string titleSubstring) {
            IntPtr best = IntPtr.Zero;
            int bestLen = -1;
            EnumWindows(delegate(IntPtr hwnd, IntPtr lp) {
                if (!IsWindowVisible(hwnd)) return true;
                if (GetWindow(hwnd, GW_OWNER) != IntPtr.Zero) return true;
                if ((GetWindowLong(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return true;
                int cloaked;
                if (DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
                uint pid;
                GetWindowThreadProcessId(hwnd, out pid);
                StringBuilder sb = new StringBuilder(512);
                GetWindowText(hwnd, sb, 512);
                string title = sb.ToString();
                if (title.Length == 0) return true;
                bool match = pids.Count > 0 ? pids.Contains(pid) : title.IndexOf(titleSubstring, StringComparison.OrdinalIgnoreCase) >= 0;
                if (!match) return true;
                if (title.Length > bestLen) { bestLen = title.Length; best = hwnd; }
                return true;
            }, IntPtr.Zero);
            return best;
        }

        /// <summary>True while the cached window handle is still a real window.</summary>
        public static bool WindowAlive(IntPtr hwnd) {
            return hwnd != IntPtr.Zero && IsWindow(hwnd);
        }

        /// <summary>The window's current title (the app mirrors the open session's title here).</summary>
        public static string WindowTitle(IntPtr hwnd) {
            if (hwnd == IntPtr.Zero) return "";
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hwnd, sb, 512);
            return sb.ToString();
        }

        /// <summary>Renders the digit bubble: red or black disc, white bold digits, 4x supersampled.</summary>
        public static IntPtr DrawIcon(int count, int sizePx, string colorHex) {
            int scale = 4;
            int size = sizePx * scale;
            Color background;
            try { background = ColorTranslator.FromHtml(colorHex); }
            catch { background = Color.FromArgb(230, 43, 52); }
            using (Bitmap bmp = new Bitmap(size, size)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                    g.Clear(Color.Transparent);
                    int pad = (int)(size * 0.04);
                    using (SolidBrush bubble = new SolidBrush(background)) {
                        g.FillEllipse(bubble, pad, pad, size - 2 * pad - 1, size - 2 * pad - 1);
                    }
                    string text = count > 99 ? "99+" : count.ToString();
                    float fontSize = text.Length >= 3 ? size * 0.32f : (text.Length == 2 ? size * 0.46f : size * 0.58f);
                    using (Font font = new Font("Segoe UI", fontSize, FontStyle.Bold, GraphicsUnit.Pixel))
                    using (StringFormat sf = new StringFormat()) {
                        sf.Alignment = StringAlignment.Center;
                        sf.LineAlignment = StringAlignment.Center;
                        using (SolidBrush white = new SolidBrush(Color.White)) {
                            RectangleF rect = new RectangleF(pad, pad - size * 0.015f, size - 2 * pad, size - 2 * pad);
                            g.DrawString(text, font, white, rect, sf);
                        }
                    }
                }
                return DownsampleIcon(bmp, sizePx);
            }
        }

        /// <summary>
        /// Tray icon = the application's own icon with a corner digit badge, the way
        /// Windows overlays badges on a taskbar button (rather than a bare bubble).
        /// Falls back to a centred bubble when the base icon cannot be read.
        /// </summary>
        public static IntPtr DrawTrayIcon(int count, int sizePx, string colorHex, string basePath) {
            int scale = 4;
            int size = sizePx * scale;
            Icon baseIcon = null;
            if (basePath != null && basePath.Length > 0) {
                try { baseIcon = Icon.ExtractAssociatedIcon(basePath); }
                catch { baseIcon = null; }
            }
            using (Bitmap bmp = new Bitmap(size, size)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.Clear(Color.Transparent);
                    if (baseIcon != null) {
                        try {
                            using (Bitmap baseBmp = baseIcon.ToBitmap()) {
                                int inset = (int)(size * 0.02);
                                g.DrawImage(baseBmp, new Rectangle(inset, inset, size - 2 * inset, size - 2 * inset));
                            }
                        } catch { baseIcon = null; }
                    }
                    if (baseIcon == null && count > 0) {
                        // no base icon: fall back to the plain bubble filling the icon
                        Color plain;
                        try { plain = ColorTranslator.FromHtml(colorHex); }
                        catch { plain = Color.FromArgb(230, 43, 52); }
                        int pad = (int)(size * 0.04);
                        using (SolidBrush b = new SolidBrush(plain)) g.FillEllipse(b, pad, pad, size - 2 * pad - 1, size - 2 * pad - 1);
                        string t = count > 99 ? "99+" : count.ToString();
                        float fsz = t.Length >= 3 ? size * 0.32f : (t.Length == 2 ? size * 0.46f : size * 0.58f);
                        using (Font f = new Font("Segoe UI", fsz, FontStyle.Bold, GraphicsUnit.Pixel))
                        using (StringFormat sf0 = new StringFormat()) {
                            sf0.Alignment = StringAlignment.Center;
                            sf0.LineAlignment = StringAlignment.Center;
                            using (SolidBrush w = new SolidBrush(Color.White))
                                g.DrawString(t, f, w, new RectangleF(pad, pad - size * 0.015f, size - 2 * pad, size - 2 * pad), sf0);
                        }
                    }
                    if (count > 0) {
                        Color background;
                        try { background = ColorTranslator.FromHtml(colorHex); }
                        catch { background = Color.FromArgb(230, 43, 52); }
                        string text = count > 99 ? "99+" : count.ToString();
                        bool wide = text.Length >= 3;
                        int d = (int)(size * 0.60);
                        int bw = wide ? (int)(d * 1.55) : d;
                        int bh = d;
                        int ring = (int)(size * 0.055);
                        int x = size - bw - (int)(size * 0.01);
                        int y = size - bh - (int)(size * 0.01);
                        using (SolidBrush ringBrush = new SolidBrush(Color.White)) {
                            if (wide) FillRounded(g, ringBrush, x - ring, y - ring, bw + 2 * ring, bh + 2 * ring, (bh + 2 * ring) / 2);
                            else g.FillEllipse(ringBrush, x - ring, y - ring, bh + 2 * ring, bh + 2 * ring);
                        }
                        using (SolidBrush bubble = new SolidBrush(background)) {
                            if (wide) FillRounded(g, bubble, x, y, bw, bh, bh / 2);
                            else g.FillEllipse(bubble, x, y, bh, bh);
                        }
                        float fontSize = wide ? bh * 0.50f : (text.Length == 2 ? d * 0.62f : d * 0.78f);
                        using (Font font = new Font("Segoe UI", fontSize, FontStyle.Bold, GraphicsUnit.Pixel))
                        using (StringFormat sf = new StringFormat()) {
                            sf.Alignment = StringAlignment.Center;
                            sf.LineAlignment = StringAlignment.Center;
                            sf.FormatFlags = StringFormatFlags.NoWrap;
                            using (SolidBrush white = new SolidBrush(Color.White))
                                g.DrawString(text, font, white, new RectangleF(x, y - bh * 0.02f, bw, bh), sf);
                        }
                    }
                }
                if (baseIcon != null) baseIcon.Dispose();
                return DownsampleIcon(bmp, sizePx);
            }
        }
        private static IntPtr DownsampleIcon(Bitmap source, int sizePx) {
            using (Bitmap output = new Bitmap(sizePx, sizePx, System.Drawing.Imaging.PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(output)) {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.Clear(Color.Transparent);
                    g.DrawImage(source, new Rectangle(0, 0, sizePx, sizePx));
                }
                return output.GetHicon();
            }
        }

        private static void FillRounded(Graphics g, Brush brush, int x, int y, int w, int h, int r) {
            using (GraphicsPath path = new GraphicsPath()) {
                int dd = r * 2;
                path.AddArc(x, y, dd, dd, 180, 90);
                path.AddArc(x + w - dd, y, dd, dd, 270, 90);
                path.AddArc(x + w - dd, y + h - dd, dd, dd, 0, 90);
                path.AddArc(x, y + h - dd, dd, dd, 90, 90);
                path.CloseFigure();
                g.FillPath(brush, path);
            }
        }

        public static void DestroyIconSafe(IntPtr hIcon) {
            if (hIcon != IntPtr.Zero) DestroyIcon(hIcon);
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

$script:com = [IntPtr]::Zero
$script:setOverlay = $null
$hrInit = $null
$script:via = ""
$script:initHr = -1
try {
  $script:via = [DshTray.Native]::TryCreateTaskbar([ref]$script:com, [ref]$hrInit, [ref]$script:setOverlay)
  if ($script:com -ne [IntPtr]::Zero) { $script:initHr = $hrInit.Invoke($script:com) }
} catch { Trace ("COM init failed: " + $_.Exception.Message) }
Trace ("started watchPid=" + $script:watchPid + " interface=" + $script:via + " HrInit=" + $script:initHr)
$script:pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
foreach ($proc in @(Get-Process -Name "DeepSeek Harness" -ErrorAction SilentlyContinue)) { [void]$script:pids.Add([uint32]$proc.Id) }
$icon = New-Object Windows.Forms.NotifyIcon
$icon.Visible = $false
$icon.Text = "DSH notifications"
$icon.add_Click({ param($sender, $e)
  if ($e.Button -eq [Windows.Forms.MouseButtons]::Left -and $script:url -ne "") { Start-Process $script:url }
})
function Read-State {
  try { return (Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
function Write-Status([IntPtr]$hwnd, [int]$hr) {
  $stamp = "$hwnd/$hr/$script:count/$script:color"
  if ($stamp -eq $script:lastStatus) { return }
  $script:lastStatus = $stamp
  $value = @{ hwnd = $hwnd.ToInt64(); hresult = $hr; count = $script:count; color = $script:color; via = $script:via; ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
  $out = Join-Path $script:stateDir "native-status.json"
  [IO.File]::WriteAllText($out + ".tmp", ($value | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath ($out + ".tmp") -Destination $out -Force
  Trace ("overlay hwnd=" + $hwnd + " count=" + $script:count + " color=" + $script:color + " HRESULT=" + $hr)
}
function Update-Visual {
  if ($script:count -gt 0 -and $script:trayEnabled) {
    $next = [DshTray.Native]::DrawTrayIcon($script:count, 64, $script:color, $script:baseIconPath)
    $icon.Icon = [Drawing.Icon]::FromHandle($next)
    if ($script:hIcon -ne [IntPtr]::Zero) { [DshTray.Native]::DestroyIconSafe($script:hIcon) }
    $script:hIcon = $next
    $icon.Text = "DSH: " + $script:count
    $icon.Visible = $true
  } else {
    $icon.Visible = $false
    $icon.Icon = $null
    if ($script:hIcon -ne [IntPtr]::Zero) { [DshTray.Native]::DestroyIconSafe($script:hIcon) }
    $script:hIcon = [IntPtr]::Zero
  }
}
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 300
$timer.add_Tick({
  try {
    if (-not (Get-Process -Id $script:watchPid -ErrorAction SilentlyContinue)) { [Windows.Forms.Application]::Exit(); return }
    $state = Read-State
    if ($state -eq $null) { return }
    if ($state.exit -eq $true) { [Windows.Forms.Application]::Exit(); return }
    $n = [Math]::Max(0, [int]$state.count)
    $color = if ($state.color -eq "#1A1A1A") { "#1A1A1A" } else { "#E62B34" }
    $tray = $state.trayIcon -eq $true
    if ($state.url) { $script:url = [string]$state.url }
    $changed = $n -ne $script:count -or $color -ne $script:color -or $tray -ne $script:trayEnabled
    $script:count = $n; $script:color = $color; $script:trayEnabled = $tray
    if ($changed) { Update-Visual }
    $hwnd = [DshTray.Native]::FindMainWindow($script:pids, "DeepSeek Harness")
    if ($changed -or $hwnd -ne $script:lastHwnd -or ((Get-Date) - $script:lastOverlayAt).TotalSeconds -ge 5) {
      $script:lastHwnd = $hwnd
      $script:lastOverlayAt = Get-Date
      $hr = $script:initHr
      if ($hwnd -eq [IntPtr]::Zero) { $hr = -2 }
      elseif ($script:initHr -eq 0 -and $script:overlayDraw) {
        $image = [IntPtr]::Zero
        try {
          if ($n -gt 0) { $image = [DshTray.Native]::DrawIcon($n, 32, $script:color) }
          $hr = $script:setOverlay.Invoke($script:com, $hwnd, $image, "DSH: $n")
        } finally { [DshTray.Native]::DestroyIconSafe($image) }
      }
      Write-Status $hwnd $hr
    }
  } catch { Trace ("tick error: " + $_.Exception.Message) }
})
try { $timer.Start(); [Windows.Forms.Application]::Run() }
finally {
  $timer.Stop(); $timer.Dispose()
  $icon.Visible = $false; $icon.Dispose()
  [DshTray.Native]::DestroyIconSafe($script:hIcon)
  if ($script:com -ne [IntPtr]::Zero) {
    try { if ($script:overlayDraw -and $script:lastHwnd -ne [IntPtr]::Zero) { [void]$script:setOverlay.Invoke($script:com, $script:lastHwnd, [IntPtr]::Zero, "") } } catch {}
    [void][Runtime.InteropServices.Marshal]::Release($script:com)
  }
  try { $mutex.ReleaseMutex() } catch {}
  $mutex.Dispose()
  Trace "worker exited"
}
