@echo off
REM ====================================================================
REM  ScoreDAW for Windows - build ScoreDAW.exe
REM  Needs the .NET 8 SDK (installed with Visual Studio 2022, or from
REM  https://dotnet.microsoft.com/download/dotnet/8.0). Internet is used
REM  once to download the WebView2 package from NuGet.
REM  Result: desktop\dist\ScoreDAW.exe  (+ ScoreDawEngine.dll, ScoreDawScan.exe)
REM  Optional: "Build ScoreDAW.cmd" portable   -> also makes dist\ScoreDAW-portable
REM  Optional: "Build ScoreDAW.cmd" test       -> builds into dist-test\ (the exe in use is not touched)
REM ====================================================================
setlocal
title ScoreDAW - Build
cd /d "%~dp0"
where dotnet >nul 2>nul || (echo. & echo The .NET 8 SDK was not found. Install it from https://dotnet.microsoft.com/download/dotnet/8.0 & pause & exit /b 1)
set OUT=dist
if /I "%~1"=="test" set OUT=dist-test
REM Windows locks a running exe: close ScoreDAW first (the build cannot replace it while it is open)
if /I "%OUT%"=="dist" (
  tasklist /FI "IMAGENAME eq ScoreDAW.exe" 2>nul | find /I "ScoreDAW.exe" >nul && (
    echo.
    echo ScoreDAW.exe is open. Close it ^(save your project first^), then press a key to continue.
    echo Or close this window and run:  "Build ScoreDAW.cmd" test   to build into dist-test instead.
    pause
    tasklist /FI "IMAGENAME eq ScoreDAW.exe" 2>nul | find /I "ScoreDAW.exe" >nul && (echo ScoreDAW.exe is still open - build stopped. & pause & exit /b 1)
  )
)
echo Building ScoreDAW.exe into %OUT% ...
dotnet publish host\ScoreDAW.csproj -c Release -o %OUT% --nologo
if errorlevel 1 (echo. & echo BUILD FAILED - copy the red lines above and send them to Claude. & pause & exit /b 1)
if /I "%~1"=="portable" call :portable
echo.
echo Done: %~dp0%OUT%\ScoreDAW.exe
echo It uses the interface files of the MyDAW folder (index.html, js, css, sounds).
pause
exit /b 0
:portable
set P=dist\ScoreDAW-portable
echo Making the portable folder %P% ...
if not exist "%P%\web" mkdir "%P%\web"
copy /y dist\ScoreDAW.exe "%P%" >nul & copy /y dist\ScoreDawEngine.dll "%P%" >nul & copy /y dist\ScoreDawScan.exe "%P%" >nul
copy /y ..\index.html "%P%\web" >nul
for %%D in (css js assets sounds) do if exist "..\%%D" robocopy "..\%%D" "%P%\web\%%D" /E /NFL /NDL /NJH /NJS >nul
REM Guitar Rig engine: scripts + recordings + amp captures (not the lab app or your own files)
robocopy "..\tools\guitar-lab" "%P%\web\tools\guitar-lab" presets.js sampler.js engine.js CREDITS.md /NFL /NDL /NJH /NJS >nul
for %%D in (samples nam packs) do robocopy "..\tools\guitar-lab\%%D" "%P%\web\tools\guitar-lab\%%D" /E /NFL /NDL /NJH /NJS >nul
REM Piano Rig engine: scripts + recordings (not the lab app or your own files)
robocopy "..\tools\piano-lab" "%P%\web\tools\piano-lab" presets.js sampler.js engine.js CREDITS.md /NFL /NDL /NJH /NJS >nul
for %%D in (samples packs) do robocopy "..\tools\piano-lab\%%D" "%P%\web\tools\piano-lab\%%D" /E /NFL /NDL /NJH /NJS >nul
REM Wind Rig engine: scripts + recordings (not the lab app or your own files)
robocopy "..\tools\wind-lab" "%P%\web\tools\wind-lab" presets.js engine.js CREDITS.md /NFL /NDL /NJH /NJS >nul
for %%D in (samples packs) do robocopy "..\tools\wind-lab\%%D" "%P%\web\tools\wind-lab\%%D" /E /NFL /NDL /NJH /NJS >nul
xcopy /y /e /i licenses "%P%\licenses" >nul
exit /b 0
