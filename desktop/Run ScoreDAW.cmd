@echo off
REM Starts ScoreDAW for Windows (build it first with "Build ScoreDAW.cmd")
if exist "%~dp0dist\ScoreDAW.exe" (start "" "%~dp0dist\ScoreDAW.exe") else (echo ScoreDAW.exe is not built yet - run "Build ScoreDAW.cmd" first. & pause)
