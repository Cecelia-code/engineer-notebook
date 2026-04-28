@echo off
setlocal
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "BUNDLED_MODULES=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"

if exist "%BUNDLED_MODULES%" (
  if defined NODE_PATH (
    set "NODE_PATH=%BUNDLED_MODULES%;%NODE_PATH%"
  ) else (
    set "NODE_PATH=%BUNDLED_MODULES%"
  )
)

if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" ".\scripts\build.mjs"
  exit /b %ERRORLEVEL%
)

node ".\scripts\build.mjs"
