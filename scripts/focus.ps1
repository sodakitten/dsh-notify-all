# dsh-notify-all :: raise the DeepSeek Harness window (Windows PowerShell 5.1 compatible).
#
# Invoked by the toast's protocol activation (scheme registered by register-protocol.ps1).
# Finds the desktop app's main window, restores it when minimized, and pulls it to the
# foreground. Windows' foreground lock refuses SetForegroundWindow from a background
# process, so it attaches to the current foreground thread first; if that still fails it
# flashes the taskbar button so the user notices.
#
# ASCII-only by design (no user-visible text here; the title filter comes from the payload).
param([string]$Uri = "", [string]$Payload = "")

$ErrorActionPreference = "Continue"

$appTitle = "DeepSeek Harness"
if ($Payload -ne "") {
  try {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload))
    $data = $json | ConvertFrom-Json
    if ($data.title -ne $null -and [string]$data.title -ne "") { $appTitle = [string]$data.title }
  } catch {
    # keep the default title filter
  }
}

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace DshFocus {
    public static class Win {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool fAttach);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
        [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int index);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
        [DllImport("user32.dll")] public static extern bool FlashWindowEx(ref FLASHWINFO info);
        public delegate bool EnumProc(IntPtr h, IntPtr lp);

        [StructLayout(LayoutKind.Sequential)]
        public struct FLASHWINFO { public uint cbSize; public IntPtr hwnd; public uint dwFlags; public uint uCount; public uint dwTimeout; }

        private const uint GW_OWNER = 4;
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x80;
        private const int SW_RESTORE = 9;
        private const int SW_SHOW = 5;
        private const uint FLASHW_ALL = 3;
        private const uint FLASHW_TIMERNOFG = 12;

        /// <summary>Largest visible, unowned, non-tool window owned by the given process name.</summary>
        public static IntPtr FindByPids(HashSet<uint> pids) {
            IntPtr best = IntPtr.Zero; int bestLen = -1;
            EnumWindows(delegate(IntPtr h, IntPtr lp) {
                if (!IsWindowVisible(h)) return true;
                if (GetWindow(h, GW_OWNER) != IntPtr.Zero) return true;
                if ((GetWindowLong(h, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return true;
                uint pid; GetWindowThreadProcessId(h, out pid);
                if (!pids.Contains(pid)) return true;
                StringBuilder sb = new StringBuilder(512); GetWindowText(h, sb, 512);
                if (sb.Length == 0) return true;
                if (sb.Length > bestLen) { bestLen = sb.Length; best = h; }
                return true;
            }, IntPtr.Zero);
            return best;
        }

        public static IntPtr FindByTitle(string needle) {
            IntPtr best = IntPtr.Zero; int bestLen = -1;
            EnumWindows(delegate(IntPtr h, IntPtr lp) {
                if (!IsWindowVisible(h)) return true;
                if (GetWindow(h, GW_OWNER) != IntPtr.Zero) return true;
                if ((GetWindowLong(h, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return true;
                StringBuilder sb = new StringBuilder(512); GetWindowText(h, sb, 512);
                string title = sb.ToString();
                if (title.Length == 0) return true;
                if (title.IndexOf(needle, StringComparison.OrdinalIgnoreCase) < 0) return true;
                if (title.Length > bestLen) { bestLen = title.Length; best = h; }
                return true;
            }, IntPtr.Zero);
            return best;
        }

        public static bool Raise(IntPtr hwnd) {
            if (hwnd == IntPtr.Zero) return false;
            if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
            ShowWindow(hwnd, SW_SHOW);
            IntPtr fg = GetForegroundWindow();
            uint fgPid;
            uint fgThread = GetWindowThreadProcessId(fg, out fgPid);
            uint curThread = GetCurrentThreadId();
            bool attached = false;
            if (fgThread != 0 && fgThread != curThread) attached = AttachThreadInput(fgThread, curThread, true);
            BringWindowToTop(hwnd);
            bool ok = SetForegroundWindow(hwnd);
            if (attached) AttachThreadInput(fgThread, curThread, false);
            if (!ok) Flash(hwnd);
            return ok;
        }

        public static void Flash(IntPtr hwnd) {
            FLASHWINFO info = new FLASHWINFO();
            info.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
            info.hwnd = hwnd;
            info.dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG;
            info.uCount = 4;
            info.dwTimeout = 0;
            FlashWindowEx(ref info);
        }
    }
}
"@

$pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
foreach ($p in @(Get-Process -Name $appTitle -ErrorAction SilentlyContinue)) { [void]$pids.Add([uint32]$p.Id) }

$hwnd = [IntPtr]::Zero
if ($pids.Count -gt 0) { $hwnd = [DshFocus.Win]::FindByPids($pids) }
if ($hwnd -eq [IntPtr]::Zero) { $hwnd = [DshFocus.Win]::FindByTitle($appTitle) }
if ($hwnd -eq [IntPtr]::Zero) {
  [Console]::Error.WriteLine("dsh-notify-all focus: no window found")
  exit 2
}

$ok = [DshFocus.Win]::Raise($hwnd)
if (-not $ok) { [Console]::Error.WriteLine("dsh-notify-all focus: raised with taskbar flash only") }
exit 0
