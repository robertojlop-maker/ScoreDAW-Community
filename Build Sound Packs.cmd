@echo off
REM ===========================================================================
REM  Build Sound Packs - converts the real sounds of LiveReplica (Ableton Core
REM  Library) and Lemon-Studio (FL Studio 20) into sound packs for
REM  ScoreDAW (folder sounds\). Needs Python 3 and ffmpeg.
REM  You can run it again any time: only new sounds are converted.
REM ===========================================================================
title ScoreDAW - Build Sound Packs
cd /d "%~dp0"
set "ABLETON=C:\Proyects\Codex\Windows\Audio-y-musica\LiveReplica\RecursosOriginales\Core Library\Samples"
set "FL=C:\Proyects\Codex\Windows\Audio-y-musica\Lemon-Studio\Recursos\FL-Studio-20\Fabrica\Data\Patches"
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
if not defined PY (
  echo Python 3 was not found. Install it from https://www.python.org/downloads/ and run this again.
  pause
  exit /b 1
)
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo ffmpeg was not found. Install it with this command and run this file again:
  echo     winget install Gyan.FFmpeg
  pause
  exit /b 1
)
echo Building the sound packs. This can take several minutes the first time...
echo.
%PY% tools\build_sound_packs.py --mydaw "%~dp0." --ableton "%ABLETON%" --fl "%FL%" --pack
echo.
echo Done. Open ScoreDAW (or press F5 in it) and look at Library - Sounds.
pause
