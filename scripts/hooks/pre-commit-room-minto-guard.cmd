@echo off
rem MindrianOS pre-commit guard -- Windows cmd wrapper.
rem
rem BSL 1.1. Copyright (c) Mindrian 2026.
rem
rem Purpose (SEC-04 / Phase 87-01a / R-87-01a-WIN):
rem   This companion file exists so Windows GUI git clients (VS Code, GitHub
rem   Desktop, SourceTree) that invoke hooks via cmd.exe don't silently skip
rem   the ROOM/MINTO invariant. If git-bash is installed, we invoke the .sh
rem   guard on this file's sibling; otherwise we emit a clear stderr message
rem   so the user knows why the guard isn't running and falls back to the
rem   session-start re-install path + CI.
rem
rem Authoritative enforcement on Windows GUI-only installs comes from
rem scripts/session-start (which re-installs the hook every session via
rem Claude Code's bash-capable runner) and from CI. This wrapper is a
rem fallback that keeps the commit path unblocked for users who don't have
rem git-bash on PATH.

setlocal
set "GUARD=%~dp0pre-commit-room-minto-guard.sh"

rem Try bash on PATH first (git-bash typical install adds it)
where bash >nul 2>&1
if %ERRORLEVEL%==0 (
  bash "%GUARD%"
  exit /b %ERRORLEVEL%
)

rem Fallback: common git-for-Windows install location
set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%GITBASH%" (
  "%GITBASH%" "%GUARD%"
  exit /b %ERRORLEVEL%
)

rem No bash available -- emit clear skip message, exit 0 so commit proceeds.
rem Authoritative enforcement on Windows GUI-only installs comes from
rem scripts/session-start (which re-installs the hook via Claude Code's
rem bash-capable session runner) and from CI.
1>&2 echo [mindrian-os] skipping ROOM/MINTO guard on Windows without git-bash
1>&2 echo [mindrian-os] install Git for Windows (https://git-scm.com) for local enforcement
exit /b 0
