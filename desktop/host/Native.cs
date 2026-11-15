// =====================================================================
//  ScoreDAW — Native.cs
//  P/Invoke declarations of ScoreDawEngine.dll (see engine/sdaw_engine.h).
// =====================================================================
using System.Runtime.InteropServices;

namespace ScoreDAW
{
    internal static class Native
    {
        private const string Dll = "ScoreDawEngine.dll";

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_init(int bufferMs);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_shutdown();
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sdaw_last_error();
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern double sdaw_now_ms();
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_sample_rate();
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_output_latency_ms();

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
        public static extern int sdaw_load(int track, int slot,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string path,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string uid,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string format);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_unload(int track, int slot);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_remove_track(int track);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_set_track(int track, float vol, float pan, int mute);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_set_bypass(int track, int slot, int bypass);

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_note(int track, int key, int vel, int channel, double atMs);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_all_notes_off();
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_set_transport(double tempo, int playing, double ppq, double atMs);

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
        public static extern int sdaw_open_editor(int track, int slot, IntPtr owner, [MarshalAs(UnmanagedType.LPWStr)] string title);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_close_editor(int track, int slot);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern void sdaw_idle();

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_get_state(int track, int slot, byte[] buf, int cap);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_set_state(int track, int slot, byte[] buf, int len);
        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)] public static extern int sdaw_get_levels(int[] ids, float[] peaks, int max);

        [DllImport(Dll, CallingConvention = CallingConvention.Cdecl)]
        public static extern int sdaw_render_track(int track, double[] times, int[] notes, int count, double seconds, [MarshalAs(UnmanagedType.LPWStr)] string wavPath);

        public static string LastError()
        {
            IntPtr p = sdaw_last_error();
            return p == IntPtr.Zero ? "" : Marshal.PtrToStringUTF8(p) ?? "";
        }

        /// <summary>Plugin state as a byte array (empty when the plugin has none).</summary>
        public static byte[] GetState(int track, int slot)
        {
            int n = sdaw_get_state(track, slot, null, 0);
            if (n <= 0) return Array.Empty<byte>();
            var buf = new byte[n];
            sdaw_get_state(track, slot, buf, n);
            return buf;
        }
    }
}
