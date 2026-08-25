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

REM Check Git
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git not found. Install from https://git-scm.com
    exit /b 1
)
echo [OK] Git found

REM Check Bun (optional but recommended for faster dev)
where bun >nul 2>nul
if errorlevel 1 (
    echo [INFO] Bun not found. Will use tsx instead. To install Bun: https://bun.sh
    set USE_BUN=0
) else (
    echo [OK] Bun found:
    bun --version
    set USE_BUN=1
)

echo.
echo [1/6] Installing ROOT dependencies...
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
echo [2/6] CRITICAL: Generating Prisma Client at ROOT level...
echo       This is required by BOTH the Next.js app AND the WebSocket mini-service.
if !USE_BUN!==1 (
    call bunx prisma generate
) else (
    call npx prisma generate
)
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client at root.
    echo        Try manually: npx prisma generate
    exit /b 1
)
echo [OK] Prisma Client generated at root.

echo.
echo [3/6] Installing WebSocket mini-service dependencies...
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
cd ..\..

echo.
echo [4/6] Creating .env file if not exists...
if not exist .env (
    copy .env.example .env >nul
    echo [INFO] .env created from .env.example
    echo.
    echo ============================================
    echo  ACTION REQUIRED: Edit .env file
    echo ============================================
    echo  Open .env and set these values:
    echo.
    echo    JWT_SECRET="your-long-random-secret-32-chars"
    echo    INITIAL_ADMIN_PHONE="09123456789"
    echo    INITIAL_ADMIN_PASSWORD="your-strong-password"
    echo    STORAGE_DIR="C:/Users/MS/Documents/MyProjects/Chat-App/storage"
    echo.
    echo  Use FORWARD SLASHES (/) in STORAGE_DIR, even on Windows.
    echo  After editing .env, re-run this script or continue manually.
    echo ============================================
    echo.
    pause
) else (
    echo [OK] .env already exists
)

echo.
echo [5/6] Setting up database (pushing schema)...
if !USE_BUN!==1 (
    call bun run db:push
) else (
    call npx prisma db push --accept-data-loss
)
if errorlevel 1 (
    echo [ERROR] Database schema push failed.
    exit /b 1
)

echo.
echo [6/6] Seeding initial admin user...
if !USE_BUN!==1 (
    call bun scripts\seed.js
) else (
    call node scripts\seed.js
)
if errorlevel 1 (
    echo [ERROR] Admin seed failed.
    exit /b 1
)

echo.
echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo  To start the app, run TWO terminals:
echo.
echo    Terminal 1 (Next.js):
echo      bun run dev   ^(or: npm run dev^)
echo.
echo    Terminal 2 (WebSocket):
echo      cd mini-services\websocket
echo      bun run dev   ^(or: npm run dev^)
echo.
echo  Then open http://localhost:3000
echo.
echo  Default admin login:
echo    Phone: see INITIAL_ADMIN_PHONE in .env
echo    Password: see INITIAL_ADMIN_PASSWORD in .env
echo.
endlocal
