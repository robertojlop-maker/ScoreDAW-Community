// =====================================================================
//  ScoreDAW — PluginScanner.cs
//  Finds VST3 / CLAP plugins and asks ScoreDawScan.exe what is inside
//  each one (a separate process: a plugin that crashes while scanning
//  cannot take ScoreDAW down). Results are cached in
//  %APPDATA%\ScoreDAW\plugins.json and only new / changed files are
//  scanned again.
// =====================================================================
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ScoreDAW
{
    public sealed class PluginInfo
    {
        [JsonPropertyName("format")] public string Format { get; set; } = "";
        [JsonPropertyName("path")] public string Path { get; set; } = "";
        [JsonPropertyName("uid")] public string Uid { get; set; } = "";
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("vendor")] public string Vendor { get; set; } = "";
        [JsonPropertyName("category")] public string Category { get; set; } = "";
        [JsonPropertyName("instrument")] public bool Instrument { get; set; }
    }

    internal sealed class ScanCache
    {
        public Dictionary<string, long> Stamps { get; set; } = new();          // path -> last write (ticks)
        public Dictionary<string, string> Failed { get; set; } = new();        // path -> error
        public List<PluginInfo> Plugins { get; set; } = new();
    }

    internal sealed class PluginScanner
    {
        public static string DataDir => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ScoreDAW");
        private static string CachePath => System.IO.Path.Combine(DataDir, "plugins.json");
        private ScanCache cache = new();

        public IReadOnlyList<PluginInfo> Plugins => cache.Plugins;
        public IReadOnlyDictionary<string, string> Failed => cache.Failed;

        /// <summary>Standard plugin folders of Windows + the folders chosen by the user.</summary>
        public static List<string> DefaultFolders()
        {
            string common = Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return new List<string> {
                System.IO.Path.Combine(common, "VST3"), System.IO.Path.Combine(local, "Programs", "Common", "VST3"),
                System.IO.Path.Combine(common, "CLAP"), System.IO.Path.Combine(local, "Programs", "Common", "CLAP")
            };
        }

        public void Load()
        {
            try { if (File.Exists(CachePath)) cache = JsonSerializer.Deserialize<ScanCache>(File.ReadAllText(CachePath)) ?? new ScanCache(); }
            catch { cache = new ScanCache(); }
        }

        private void Save()
        {
            Directory.CreateDirectory(DataDir);
            File.WriteAllText(CachePath, JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true }));
        }

        /// <summary>Plugin files / bundles in a folder (sub-folders included, bundles not entered).</summary>
        private static IEnumerable<(string path, string format)> Candidates(string folder)
        {
            var stack = new Stack<string>();
            if (Directory.Exists(folder)) stack.Push(folder);
            while (stack.Count > 0)
            {
                string dir = stack.Pop();
                string[] files = Array.Empty<string>(), dirs = Array.Empty<string>();
                try { files = Directory.GetFiles(dir); dirs = Directory.GetDirectories(dir); } catch { continue; }
                foreach (var f in files)
                {
                    string ext = System.IO.Path.GetExtension(f).ToLowerInvariant();
                    if (ext == ".vst3") yield return (f, "VST3");
                    else if (ext == ".clap") yield return (f, "CLAP");
                }
                foreach (var d in dirs)
                {
                    if (d.EndsWith(".vst3", StringComparison.OrdinalIgnoreCase)) yield return (d, "VST3");   // bundle folder
                    else stack.Push(d);
                }
            }
        }

        private static long StampOf(string path)
        {
            try { return Directory.Exists(path) ? Directory.GetLastWriteTimeUtc(path).Ticks : File.GetLastWriteTimeUtc(path).Ticks; }
            catch { return 0; }
        }

        /// <summary>
        /// Scans the folders. force = scan everything again. progress(done, total, name) is
        /// called from the worker thread.
        /// </summary>
        public async Task ScanAsync(IEnumerable<string> folders, bool force, Action<int, int, string> progress)
        {
            if (force) cache = new ScanCache();
            var found = folders.Distinct(StringComparer.OrdinalIgnoreCase).SelectMany(Candidates)
                               .GroupBy(c => c.path, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
            var alive = new HashSet<string>(found.Select(f => f.path), StringComparer.OrdinalIgnoreCase);
            // forget removed plugins
            cache.Plugins.RemoveAll(p => !alive.Contains(p.Path));
            foreach (var k in cache.Stamps.Keys.Where(k => !alive.Contains(k)).ToList()) cache.Stamps.Remove(k);
            int done = 0;
            foreach (var (path, format) in found)
            {
                done++;
                long stamp = StampOf(path);
                if (cache.Stamps.TryGetValue(path, out long old) && old == stamp) continue;
                progress?.Invoke(done, found.Count, System.IO.Path.GetFileName(path));
                var result = await Task.Run(() => ScanOne(path, format));
                cache.Plugins.RemoveAll(p => string.Equals(p.Path, path, StringComparison.OrdinalIgnoreCase));
                cache.Failed.Remove(path);
                if (result.error != null) cache.Failed[path] = result.error;
                else cache.Plugins.AddRange(result.list);
                cache.Stamps[path] = stamp;
            }
            cache.Plugins.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
            Save();
            progress?.Invoke(found.Count, found.Count, "");
        }

        private static (List<PluginInfo> list, string error) ScanOne(string path, string format)
        {
            string exe = System.IO.Path.Combine(AppContext.BaseDirectory, "ScoreDawScan.exe");
            if (!File.Exists(exe)) return (new List<PluginInfo>(), "ScoreDawScan.exe is missing");
            var psi = new ProcessStartInfo(exe) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8 };
            psi.ArgumentList.Add(format); psi.ArgumentList.Add(path);
            try
            {
                using var p = Process.Start(psi);
                var outTask = p.StandardOutput.ReadToEndAsync();
                var errTask = p.StandardError.ReadToEndAsync();
                if (!p.WaitForExit(20000)) { try { p.Kill(true); } catch { } return (new List<PluginInfo>(), "timed out while loading"); }
                string json = outTask.Result.Trim();
                if (p.ExitCode != 0) return (new List<PluginInfo>(), (errTask.Result.Trim().Length > 0 ? errTask.Result.Trim() : "crashed while loading (exit " + p.ExitCode + ")"));
                var list = JsonSerializer.Deserialize<List<PluginInfo>>(string.IsNullOrEmpty(json) ? "[]" : json) ?? new List<PluginInfo>();
                return (list, null);
            }
            catch (Exception e) { return (new List<PluginInfo>(), e.Message); }
        }
    }
}
