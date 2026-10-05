// Compiled as a Windows GUI subsystem executable: protocol clicks never allocate a console.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace DshNotifyActivation {
    public static class Program {
        private static bool ValidSession(string id) {
            return id != null && Regex.IsMatch(id, "\\Asession-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\\z");
        }
        public static bool TryActivation(string address, string key, out string sessionId) {
            sessionId = null;
            Uri uri;
            if (address == null || address.Length > 8192 || !Uri.TryCreate(address, UriKind.Absolute, out uri) ||
                uri.Scheme != "dsh-notify-all" || uri.UserInfo.Length != 0 || !uri.IsDefaultPort || uri.Fragment.Length != 0) return false;
            if (uri.Host == "session") {
                string id = uri.AbsolutePath.TrimStart('/');
                if (!ValidSession(id) || address != "dsh-notify-all://session/" + id) return false;
                sessionId = id; return true;
            }
            if (uri.Host != "open" || (uri.AbsolutePath.Length != 0 && uri.AbsolutePath != "/")) return false;
            string supplied = null, session = null;
            foreach (string pair in uri.Query.TrimStart('?').Split('&')) {
                int equal = pair.IndexOf('=');
                if (equal <= 0) return false;
                string name = pair.Substring(0,equal), value = Uri.UnescapeDataString(pair.Substring(equal+1));
                if (name == "key" && supplied == null) supplied = value;
                else if (name == "session" && session == null) session = value;
                else return false;
            }
            if (key == null || key.Length < 32 || key != supplied || (session != null && !ValidSession(session))) return false;
            sessionId = session; return true;
        }
        [STAThread]
        public static int Main(string[] args) {
            string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            try {
                if (args.Length != 1 || args[0].Length > 8192) return 2;
                string key = File.ReadAllText(Path.Combine(dir, "activation-key.txt"), Encoding.UTF8).Trim();
                string sessionId;
                if (!TryActivation(args[0],key,out sessionId)) return 3;
                string inbox = Path.Combine(dir, "activation-inbox");
                Directory.CreateDirectory(inbox);
                string id = Guid.NewGuid().ToString("N");
                string temporary = Path.Combine(inbox, id + ".tmp");
                File.WriteAllText(temporary, args[0], new UTF8Encoding(false));
                File.Move(temporary, Path.Combine(inbox, id + ".uri"));
                // DSH's own registered GUI protocol restores/focuses its existing main window.
                Process.Start(new ProcessStartInfo("dsh://open") { UseShellExecute = true });
                return 0;
            } catch (Exception error) {
                try { File.AppendAllText(Path.Combine(dir, "activation.log"), DateTime.UtcNow.ToString("o") + " " + error.Message + Environment.NewLine); } catch { }
                return 1;
            }
        }
    }
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    internal class ShellLink { }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
    internal interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max, IntPtr find, uint flags);
        void GetIDList(out IntPtr id); void SetIDList(IntPtr id);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder description, int max);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string description);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder directory, int max);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder arguments, int max);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);
        void GetHotkey(out short hotkey); void SetHotkey(short hotkey);
        void GetShowCmd(out int command); void SetShowCmd(int command);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int max, out int index);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags); void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }
    [StructLayout(LayoutKind.Sequential)]
    internal struct PropertyKey { public Guid format; public uint id; }
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    internal struct PropVariant { [FieldOffset(0)] public ushort type; [FieldOffset(8)] public IntPtr text; }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    internal interface IPropertyStore {
        void GetCount(out uint count); void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value); void Commit();
    }
    public static class ShellIntegration {
        public static void Register(string appId, string launcher, string dshExe, string iconPath, string uri, string shortcutPath) {
            using (Icon icon = Icon.ExtractAssociatedIcon(dshExe))
            using (Bitmap bitmap = icon.ToBitmap()) { bitmap.Save(iconPath, System.Drawing.Imaging.ImageFormat.Png); }
            using (RegistryKey identity = Registry.CurrentUser.CreateSubKey("Software\\Classes\\AppUserModelId\\" + appId)) {
                identity.SetValue("DisplayName", "DeepSeek Harness");
                identity.SetValue("IconUri", iconPath);
                identity.SetValue("IconBackgroundColor", "0");
            }
            object instance = new ShellLink();
            try {
                IShellLinkW link = (IShellLinkW)instance;
                link.SetPath(launcher); link.SetArguments("\"" + uri + "\"");
                link.SetDescription("DeepSeek Harness notifications");
                link.SetIconLocation(dshExe, 0); link.SetShowCmd(1);
                PropertyKey key = new PropertyKey { format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), id = 5 };
                PropVariant value = new PropVariant { type = 31, text = Marshal.StringToCoTaskMemUni(appId) };
                try { IPropertyStore store = (IPropertyStore)instance; store.SetValue(ref key, ref value); store.Commit(); }
                finally { Marshal.FreeCoTaskMem(value.text); }
                ((IPersistFile)instance).Save(shortcutPath, true);
            } finally { Marshal.FinalReleaseComObject(instance); }
        }
    }
}
