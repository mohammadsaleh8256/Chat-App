@echo off
REM ============================================================
REM Chatgram - Windows Setup Script
REM Run this ONCE after cloning the repository.
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo ============================================
echo  Chatgram Setup - Windows
echo ============================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org (LTS recommended).
    exit /b 1
)
echo [OK] Node.js found: 
node --version

REM Check Bun (optional but recommended)
where bun >nul 2>nul
if errorlevel 1 (
    echo [INFO] Bun not found. Will use tsx instead. To install Bun: https://bun.sh
    set USE_BUN=0
) else (
    echo [OK] Bun found:
    bun --version
    set USE_BUN=1
)

REM Check Git
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git not found. Install from https://git-scm.com
    exit /b 1
)
echo [OK] Git found

echo.
echo [1/5] Installing root dependencies...
if !USE_BUN!==1 (
    call bun install
) else (
    call npm install
)
if errorlevel 1 (
    echo [ERROR] Failed to install root dependencies.
    exit /b 1
)

echo.
echo [2/5] Installing WebSocket mini-service dependencies...
cd mini-services\websocket
if !USE_BUN!==1 (
    call bun install
) else (
    call npm install
)
if errorlevel 1 (
    echo [ERROR] Failed to install mini-service dependencies.
    exit /b 1
)

echo.
echo [3/5] Generating Prisma Client for mini-service...
call npx prisma generate --schema ..\..\prisma\schema.prisma
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma client for mini-service.
    exit /b 1
)
cd ..\..

echo.
echo [4/5] Creating .env file if not exists...
if not exist .env (
    copy .env.example .env >nul
    echo [INFO] .env created from .env.example
    echo [WARN] Open .env and set STORAGE_DIR to your absolute project path.
    echo        Example: STORAGE_DIR="C:/Users/MS/Documents/MyProjects/Chat-App/storage"
) else (
    echo [OK] .env already exists
)

echo.
echo [5/5] Setting up database and seeding admin...
if !USE_BUN!==1 (
    call bun run db:push
    call bun scripts\seed.js
) else (
    call npx prisma db push --accept-data-loss
    call node scripts\seed.js
)
if errorlevel 1 (
    echo [ERROR] Database setup failed.
    exit /b 1
)

echo.
echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo To start the app, run TWO terminals:
echo.
echo   Terminal 1 (Next.js):
echo     bun run dev      (or: npm run dev)
echo.
echo   Terminal 2 (WebSocket):
echo     cd mini-services\websocket
echo     bun run dev     (or: npm run dev)
echo.
echo Then open http://localhost:3000
echo.
echo Default admin login:
echo   Phone: see INITIAL_ADMIN_PHONE in .env
echo   Password: see INITIAL_ADMIN_PASSWORD in .env
echo.
endlocal
