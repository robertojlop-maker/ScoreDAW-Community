// =====================================================================
//  ScoreDAW for Windows — Bridge.cs
//  ---------------------------------------------------------------------
//  Messages between the interface (js/desktop.js) and Windows.
//
//  From the page:   { "id": 7, "cmd": "load", "args": { … } }
//  Answer:          { "reply": 7, "ok": true, "result": … }  |  { "reply": 7, "ok": false, "error": "…" }
//  Events pushed:   { "event": "levels", "data": … }  (levels, scan progress, beforeClose…)
// =====================================================================
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace ScoreDAW
{
    internal sealed class Bridge
    {
        private readonly MainForm form;
        private readonly CoreWebView2 web;
        private readonly PluginScanner scanner = new();
        private int sampleRate;
        private string engineError = "";
        private bool engineOk;
        private Action closeCallback;
        private int tickCount;
        public bool Ready { get; private set; }

        public Bridge(MainForm form, CoreWebView2 web)
        {
            this.form = form;
            this.web = web;
            scanner.Load();
            try
            {
                sampleRate = Native.sdaw_init(form.Settings.BufferMs);
                engineOk = sampleRate > 0;
                if (!engineOk) engineError = Native.LastError();
            }
            catch (Exception e) { engineOk = false; engineError = "ScoreDawEngine.dll: " + e.Message; }
        }

        /* ------------------------------------------------------- sending */
        private void Post(object o) { try { web.PostWebMessageAsJson(JsonSerializer.Serialize(o)); } catch { } }
        private void Reply(int id, object result) => Post(new { reply = id, ok = true, result });
        private void Fail(int id, string error) => Post(new { reply = id, ok = false, error });
        public void Event(string name, object data) => Post(new { @event = name, data });

        /* ------------------------------------------------------ receiving */
        public async void OnMessage(string json)
        {
            int id = 0;
            try
            {
                var msg = JsonNode.Parse(json);
                id = msg?["id"]?.GetValue<int>() ?? 0;
                string cmd = msg?["cmd"]?.GetValue<string>() ?? "";
                var a = msg?["args"] as JsonObject ?? new JsonObject();
                object r = await Handle(cmd, a);
                if (id != 0) Reply(id, r);
            }
            catch (Exception e) { if (id != 0) Fail(id, e.Message); }
        }

        private static int I(JsonObject a, string k, int d = 0) => a[k] is JsonValue v && v.TryGetValue(out double x) ? (int)x : d;
        private static double D(JsonObject a, string k, double d = 0) => a[k] is JsonValue v && v.TryGetValue(out double x) ? x : d;
        private static string S(JsonObject a, string k) => a[k]?.GetValue<string>() ?? "";

        private void Need() { if (!engineOk) throw new InvalidOperationException("The plugin engine is not running: " + engineError); }

        private async Task<object> Handle(string cmd, JsonObject a)
        {
            switch (cmd)
            {
                case "hello":
                    Ready = true;
                    string file = form.StartupFile;
                    return new
                    {
                        app = "ScoreDAW", version = Application.ProductVersion, engine = engineOk, engineError, sampleRate,
                        latencyMs = engineOk ? Native.sdaw_output_latency_ms() : 0, now = engineOk ? Native.sdaw_now_ms() : 0,
                        plugins = scanner.Plugins, failed = scanner.Failed.Count, folders = AllFolders(), userFolders = form.Settings.PluginFolders,
                        startupFile = file != null ? new { name = Path.GetFileName(file), text = File.ReadAllText(file) } : null
                    };
                case "clock":
                    return new { now = engineOk ? Native.sdaw_now_ms() : 0 };
                case "scan":
                {
                    bool force = a["force"]?.GetValue<bool>() ?? false;
                    await scanner.ScanAsync(AllFolders(), force, (d, t, n) => form.BeginInvoke(new Action(() => Event("scan", new { done = d, total = t, name = n }))));
                    return new { plugins = scanner.Plugins, failed = scanner.Failed.Select(kv => new { path = kv.Key, error = kv.Value }) };
                }
                case "folders":
                {
                    if (a["set"] is JsonArray arr) { form.Settings.PluginFolders = arr.Select(x => x?.GetValue<string>() ?? "").Where(x => x.Length > 0).ToList(); form.Settings.Save(); }
                    return new { folders = AllFolders(), userFolders = form.Settings.PluginFolders };
                }
                case "pickFolder":
                {
                    using var dlg = new FolderBrowserDialog { Description = "Folder with VST3 / CLAP plugins", UseDescriptionForTitle = true };
                    return dlg.ShowDialog(form) == DialogResult.OK ? dlg.SelectedPath : null;
                }
                case "load":
                {
                    Need();
                    int flags = Native.sdaw_load(I(a, "track"), I(a, "slot"), S(a, "path"), S(a, "uid"), S(a, "format"));
                    if (flags == 0) throw new InvalidOperationException(Native.LastError());
                    string st = S(a, "state");
                    if (st.Length > 0) { var b = Convert.FromBase64String(st); Native.sdaw_set_state(I(a, "track"), I(a, "slot"), b, b.Length); }
                    return new { instrument = (flags & 2) != 0, editor = (flags & 4) != 0 };
                }
                case "unload": if (engineOk) Native.sdaw_unload(I(a, "track"), I(a, "slot")); return true;
                case "removeTrack": if (engineOk) Native.sdaw_remove_track(I(a, "track")); return true;
                case "setTrack": if (engineOk) Native.sdaw_set_track(I(a, "track"), (float)D(a, "vol", 0.8), (float)D(a, "pan"), I(a, "mute")); return true;
                case "bypass": if (engineOk) Native.sdaw_set_bypass(I(a, "track"), I(a, "slot"), I(a, "bypass")); return true;
                case "notes":
                    if (engineOk && a["list"] is JsonArray list)
                        foreach (var n in list.OfType<JsonArray>())
                            Native.sdaw_note((int)n[0].GetValue<double>(), (int)n[1].GetValue<double>(), (int)n[2].GetValue<double>(), (int)n[3].GetValue<double>(), n[4].GetValue<double>());
                    return true;
                case "allOff": if (engineOk) Native.sdaw_all_notes_off(); return true;
                case "transport": if (engineOk) Native.sdaw_set_transport(D(a, "tempo", 120), I(a, "playing"), D(a, "ppq"), D(a, "atMs")); return true;
                case "editor":
                    Need();
                    if (Native.sdaw_open_editor(I(a, "track"), I(a, "slot"), form.Handle, S(a, "title")) == 0) throw new InvalidOperationException(Native.LastError());
                    return true;
                case "closeEditor": if (engineOk) Native.sdaw_close_editor(I(a, "track"), I(a, "slot")); return true;
                case "getState":
                    Need();
                    return Convert.ToBase64String(Native.GetState(I(a, "track"), I(a, "slot")));
                case "setState":
                {
                    Need();
                    var b = Convert.FromBase64String(S(a, "data"));
                    return Native.sdaw_set_state(I(a, "track"), I(a, "slot"), b, b.Length) == 1;
                }
                case "render": return await Render(a);
                case "fullscreen": form.ToggleFullScreen(); return true;
                case "openUrl": MainForm.OpenExternal(S(a, "url")); return true;
                case "closeReady": closeCallback?.Invoke(); closeCallback = null; return true;
                // the page could not autosave and the user chose to stay: the window remains open
                case "closeCancel": closeCallback = null; form.CancelClose(); return true;
                default: throw new InvalidOperationException("unknown command " + cmd);
            }
        }

        private List<string> AllFolders() => PluginScanner.DefaultFolders().Concat(form.Settings.PluginFolders).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        /// <summary>
        /// Offline render of the plugin tracks for an export: one WAV per track,
        /// returned as https://render.scoredaw/… URLs the page can fetch.
        /// </summary>
        private async Task<object> Render(JsonObject a)
        {
            Need();
            double seconds = D(a, "seconds", 10);
            var outList = new List<object>();
            foreach (var t in (a["tracks"] as JsonArray ?? new JsonArray()).OfType<JsonObject>())
            {
                int track = I(t, "track");
                var ev = (t["events"] as JsonArray ?? new JsonArray()).OfType<JsonArray>().ToList();
                var times = new double[ev.Count]; var notes = new int[ev.Count * 3];
                for (int i = 0; i < ev.Count; i++)
                {
                    times[i] = ev[i][0].GetValue<double>();
                    notes[i * 3] = (int)ev[i][1].GetValue<double>(); notes[i * 3 + 1] = (int)ev[i][2].GetValue<double>(); notes[i * 3 + 2] = (int)ev[i][3].GetValue<double>();
                }
                string name = "track" + track + "_" + DateTime.Now.Ticks + ".wav";
                string path = Path.Combine(MainForm.RenderDir, name);
                int ok = await Task.Run(() => Native.sdaw_render_track(track, times, notes, ev.Count, seconds, path));
                if (ok == 0) throw new InvalidOperationException("render of track " + track + ": " + Native.LastError());
                outList.Add(new { track, url = "https://" + MainForm.RenderHost + "/" + name });
            }
            return outList;
        }

        /* ----------------------------------------------------- periodic */
        public void Tick()
        {
            if (!engineOk) return;
            Native.sdaw_idle();
            if (++tickCount % 3 != 0 || !Ready) return;                 // meters ~10 times a second
            var ids = new int[128]; var peaks = new float[256];
            int n = Native.sdaw_get_levels(ids, peaks, 128);
            if (n == 0) return;
            var data = new Dictionary<string, float[]>();
            for (int i = 0; i < n; i++) data[ids[i].ToString()] = new[] { peaks[i * 2], peaks[i * 2 + 1] };
            Event("levels", data);
        }

        public void RequestClose(Action done)
        {
            closeCallback = done;
            Event("beforeClose", null);
            // if the page does not answer in 20 s (large autosave, or a question to the user), close anyway
            var t = new System.Windows.Forms.Timer { Interval = 20000 };
            t.Tick += (s, e) => { t.Stop(); t.Dispose(); closeCallback?.Invoke(); closeCallback = null; };
            t.Start();
        }

        public void Shutdown()
        {
            try { if (engineOk) Native.sdaw_shutdown(); } catch { }
            try { foreach (var f in Directory.GetFiles(MainForm.RenderDir, "*.wav")) File.Delete(f); } catch { }
        }
    }
}
