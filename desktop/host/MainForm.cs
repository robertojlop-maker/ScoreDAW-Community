// =====================================================================
//  ScoreDAW for Windows — MainForm.cs
//  ---------------------------------------------------------------------
//  The window: a WebView2 that shows the SAME interface as the web
//  version (index.html, css, js), served from https://app.scoredaw/ so
//  everything a browser allows (audio worklets, Web MIDI, microphone,
//  file pickers) works. Native features (plugins, file dialogs) are
//  reached through Bridge.cs.
// =====================================================================
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ScoreDAW
{
    public sealed class HostSettings
    {
        public List<string> PluginFolders { get; set; } = new();
        public int BufferMs { get; set; } = 20;
        public int X { get; set; } = -1;
        public int Y { get; set; } = -1;
        public int W { get; set; } = 1600;
        public int H { get; set; } = 950;
        public bool Maximized { get; set; } = true;

        private static string PathOf => Path.Combine(PluginScanner.DataDir, "settings.json");
        public static HostSettings Load()
        {
            try { if (File.Exists(PathOf)) return JsonSerializer.Deserialize<HostSettings>(File.ReadAllText(PathOf)) ?? new HostSettings(); }
            catch { }
            return new HostSettings();
        }
        public void Save()
        {
            Directory.CreateDirectory(PluginScanner.DataDir);
            File.WriteAllText(PathOf, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        }
    }

    public sealed class MainForm : Form
    {
        // ------------------------------------------------------------ CONFIG
        public const string AppHost = "app.scoredaw";           // virtual host of the interface
        public const string RenderHost = "render.scoredaw";     // virtual host of offline plugin renders
        public static readonly string RenderDir = Path.Combine(Path.GetTempPath(), "ScoreDAW", "render");

        private readonly WebView2 web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(14, 12, 28) };
        private readonly System.Windows.Forms.Timer idleTimer = new() { Interval = 33 };
        private readonly string[] args;
        internal HostSettings Settings = HostSettings.Load();
        internal Bridge Bridge;
        private bool closeConfirmed;
        private FormWindowState stateBeforeFull;
        private FormBorderStyle borderBeforeFull;

        public MainForm(string[] args)
        {
            this.args = args;
            Text = "ScoreDAW";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            BackColor = Color.FromArgb(14, 12, 28);
            MinimumSize = new Size(1100, 680);
            StartPosition = Settings.X >= 0 ? FormStartPosition.Manual : FormStartPosition.CenterScreen;
            if (Settings.X >= 0) Location = new Point(Settings.X, Settings.Y);
            Size = new Size(Settings.W, Settings.H);
            if (Settings.Maximized) WindowState = FormWindowState.Maximized;
            KeyPreview = true;
            Controls.Add(web);
            Load += async (s, e) => await InitAsync();
        }

        /// <summary>Folder with index.html: "web" next to the exe, else the first parent folder that has it.</summary>
        private static string FindWebRoot()
        {
            string exeDir = AppContext.BaseDirectory;
            string local = Path.Combine(exeDir, "web");
            if (File.Exists(Path.Combine(local, "index.html"))) return local;
            var dir = new DirectoryInfo(exeDir);
            for (int i = 0; i < 6 && dir != null; i++, dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "index.html")) && Directory.Exists(Path.Combine(dir.FullName, "js"))) return dir.FullName;
            return null;
        }

        private async Task InitAsync()
        {
            string root = FindWebRoot();
            if (root == null)
            {
                MessageBox.Show("The ScoreDAW interface (index.html) was not found.\nPut the 'web' folder next to ScoreDAW.exe.", "ScoreDAW", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close(); return;
            }
            Directory.CreateDirectory(RenderDir);
            var options = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required --disable-features=CalculateNativeWinOcclusion");
            CoreWebView2Environment env;
            try
            {
                env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ScoreDAW", "WebView2"), options);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show("ScoreDAW needs the Microsoft Edge WebView2 Runtime (included in Windows 11).\nDownload it from https://developer.microsoft.com/microsoft-edge/webview2/", "ScoreDAW", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close(); return;
            }
            await web.EnsureCoreWebView2Async(env);
            var cw = web.CoreWebView2;
            cw.SetVirtualHostNameToFolderMapping(AppHost, root, CoreWebView2HostResourceAccessKind.Allow);
            cw.SetVirtualHostNameToFolderMapping(RenderHost, RenderDir, CoreWebView2HostResourceAccessKind.Allow);
            cw.Settings.AreDefaultContextMenusEnabled = false;     // ScoreDAW has its own right-click menus
            cw.Settings.AreBrowserAcceleratorKeysEnabled = false;  // Ctrl+P, Ctrl+F… belong to ScoreDAW
            cw.Settings.IsStatusBarEnabled = false;
            cw.Settings.IsZoomControlEnabled = false;              // ScoreDAW has its own interface scale
            cw.Settings.AreDevToolsEnabled = true;                 // Ctrl+Shift+I (diagnostics)
            cw.PermissionRequested += (s, e) => { e.State = CoreWebView2PermissionState.Allow; e.Handled = true; };   // microphone, MIDI, clipboard, files
            cw.NewWindowRequested += (s, e) => { e.Handled = true; OpenExternal(e.Uri); };
            cw.DocumentTitleChanged += (s, e) => Text = string.IsNullOrWhiteSpace(cw.DocumentTitle) ? "ScoreDAW" : cw.DocumentTitle;
            cw.DownloadStarting += OnDownloadStarting;
            Bridge = new Bridge(this, cw);
            cw.WebMessageReceived += (s, e) => Bridge.OnMessage(e.WebMessageAsJson);
            idleTimer.Tick += (s, e) => Bridge?.Tick();
            idleTimer.Start();
            // The interface files (js, css, html) change with every ScoreDAW update, but WebView2 keeps
            // a disk cache of them: without this an updated ScoreDAW could still run the OLD scripts.
            // Only the cache is cleared — your settings, presets and library folders (local storage) stay.
            try { await cw.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache | CoreWebView2BrowsingDataKinds.CacheStorage); } catch { }
            cw.Navigate("https://" + AppHost + "/index.html");
        }

        /// <summary>A file opened with ScoreDAW.exe (double-click a .sdaw.json) is sent to the interface once it is ready.</summary>
        internal string StartupFile => args.FirstOrDefault(a => File.Exists(a));

        internal static void OpenExternal(string url)
        {
            try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
        }

        /// <summary>Exports (WAV, MIDI, project…) are saved with the normal Windows "Save as" dialog.</summary>
        private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            var deferral = e.GetDeferral();
            BeginInvoke(new Action(() =>
            {
                using (deferral)
                {
                    string name = Path.GetFileName(e.ResultFilePath);
                    string ext = Path.GetExtension(name);
                    using var dlg = new SaveFileDialog { FileName = name, Filter = (ext.Length > 1 ? ext.TrimStart('.').ToUpperInvariant() + " file|*" + ext + "|" : "") + "All files|*.*", OverwritePrompt = true };
                    if (dlg.ShowDialog(this) == DialogResult.OK)
                    {
                        e.ResultFilePath = dlg.FileName; e.Handled = true;
                        // tell the page how it ended: the file is complete (renamed over the old one) or failed
                        var op = e.DownloadOperation; string path = dlg.FileName;
                        op.StateChanged += (s2, e2) =>
                        {
                            if (op.State == CoreWebView2DownloadState.Completed) Bridge?.Event("download", new { state = "completed", path, name });
                            else if (op.State == CoreWebView2DownloadState.Interrupted) Bridge?.Event("download", new { state = "failed", path, name, reason = op.InterruptReason.ToString() });
                        };
                    }
                    else { e.Cancel = true; Bridge?.Event("download", new { state = "cancelled", name }); }
                }
            }));
        }

        internal void ToggleFullScreen()
        {
            if (FormBorderStyle != FormBorderStyle.None)
            {
                stateBeforeFull = WindowState; borderBeforeFull = FormBorderStyle;
                FormBorderStyle = FormBorderStyle.None; WindowState = FormWindowState.Normal; WindowState = FormWindowState.Maximized;
            }
            else { FormBorderStyle = borderBeforeFull; WindowState = stateBeforeFull; }
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F11) { ToggleFullScreen(); e.Handled = true; }
            else if (e.KeyCode == Keys.I && e.Control && e.Shift) { web.CoreWebView2?.OpenDevToolsWindow(); e.Handled = true; }
            base.OnKeyDown(e);
        }

        /// <summary>The page asked to stay open (its autosave failed and the user chose to save first).</summary>
        internal void CancelClose() { closeConfirmed = false; }

        /// <summary>Before closing: the interface saves the plugin states into the autosave.</summary>
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!closeConfirmed && Bridge != null && Bridge.Ready)
            {
                e.Cancel = true;
                closeConfirmed = true;
                Bridge.RequestClose(() => BeginInvoke(new Action(Close)));
                return;
            }
            Settings.Maximized = WindowState == FormWindowState.Maximized;
            if (WindowState == FormWindowState.Normal) { Settings.X = Left; Settings.Y = Top; Settings.W = Width; Settings.H = Height; }
            try { Settings.Save(); } catch { }
            idleTimer.Stop();
            Bridge?.Shutdown();
            base.OnFormClosing(e);
        }
    }
}
