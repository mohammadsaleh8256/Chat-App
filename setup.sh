#!/usr/bin/env bash
# ============================================================
# Chatgram - Linux/macOS Setup Script
# Run this ONCE after cloning the repository.
# ============================================================
set -e

echo ""
echo "============================================"
echo "  Chatgram Setup - Linux/macOS"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install from https://nodejs.org (LTS recommended)."
    exit 1
fi
echo "[OK] Node.js found: $(node --version)"

# Check Bun (optional but recommended)
USE_BUN=0
if command -v bun &> /dev/null; then
    echo "[OK] Bun found: $(bun --version)"
    USE_BUN=1
else
    echo "[INFO] Bun not found. Will use tsx instead. To install Bun: https://bun.sh"
fi

# Check Git
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git not found. Install from https://git-scm.com"
    exit 1
fi
echo "[OK] Git found"

echo ""
echo "[1/5] Installing root dependencies..."
if [ "$USE_BUN" = "1" ]; then
    bun install
else
    npm install
fi

echo ""
echo "[2/5] Installing WebSocket mini-service dependencies..."
cd mini-services/websocket
if [ "$USE_BUN" = "1" ]; then
    bun install
else
    npm install
fi

echo ""
echo "[3/5] Generating Prisma Client for mini-service..."
npx prisma generate --schema ../../prisma/schema.prisma
cd ../..

echo ""
echo "[4/5] Creating .env file if not exists..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[INFO] .env created from .env.example"
    echo "[WARN] Open .env and set STORAGE_DIR to your absolute project path."
    echo "       Example: STORAGE_DIR=\"/home/user/Chat-App/storage\""
else
    echo "[OK] .env already exists"
fi

echo ""
echo "[5/5] Setting up database and seeding admin..."
if [ "$USE_BUN" = "1" ]; then
    bun run db:push
    bun scripts/seed.js
else
    npx prisma db push --accept-data-loss
    node scripts/seed.js
fi

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "To start the app, run TWO terminals:"
echo ""
echo "  Terminal 1 (Next.js):"
echo "    bun run dev      (or: npm run dev)"
echo ""
echo "  Terminal 2 (WebSocket):"
echo "    cd mini-services/websocket"
echo "    bun run dev     (or: npm run dev)"
echo ""
echo "Then open http://localhost:3000"
echo ""
echo "Default admin login:"
echo "  Phone: see INITIAL_ADMIN_PHONE in .env"
echo "  Password: see INITIAL_ADMIN_PASSWORD in .env"
echo ""
