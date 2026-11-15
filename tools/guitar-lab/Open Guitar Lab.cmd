@echo off
rem ScoreDAW Guitar Lab: starts a tiny local web server (PowerShell, built into Windows)
rem and opens the lab in your browser. Keep the black window open while you use the lab.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
