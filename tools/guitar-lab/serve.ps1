# =====================================================================
#  ScoreDAW — Guitar Lab local web server (PowerShell, no install needed)
#  ---------------------------------------------------------------------
#  Browsers do not let a page opened from disk (file://) load the real
#  recordings, the real-amp captures (WebAssembly) or the cabinet IRs.
#  This tiny server serves the MyDAW folder at http://localhost:8765/
#  and opens Guitar Lab. Keep this window open while you use the lab;
#  close it to stop the server.
# =====================================================================
param([int]$Port = 8765)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$page = "tools/guitar-lab/index.html"
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.nam' = 'application/json'; '.wasm' = 'application/wasm'
  '.bin' = 'application/octet-stream'; '.wav' = 'audio/wav'; '.flac' = 'audio/flac'; '.ogg' = 'audio/ogg'; '.mp3' = 'audio/mpeg'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  # already running (or port busy): just open the page
  Write-Host "Server already running on $prefix (or port busy) - opening the lab."
  Start-Process ($prefix + $page)
  Start-Sleep -Seconds 2
  exit
}

Write-Host ""
Write-Host "  ScoreDAW Guitar Lab server running at $prefix" -ForegroundColor Cyan
Write-Host "  Serving: $root"
Write-Host "  Keep this window open while you use the lab. Close it to stop." -ForegroundColor Yellow
Write-Host ""
Start-Process ($prefix + $page)

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = $page }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Cache-Control', 'no-cache')
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $res.OutputStream.Close()
  } catch {
    try { $ctx.Response.Abort() } catch {}
  }
}
