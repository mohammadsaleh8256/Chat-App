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

# Check Git
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git not found. Install from https://git-scm.com"
    exit 1
fi
echo "[OK] Git found"

# Check Bun (optional but recommended)
USE_BUN=0
if command -v bun &> /dev/null; then
    echo "[OK] Bun found: $(bun --version)"
    USE_BUN=1
else
    echo "[INFO] Bun not found. Will use tsx instead. To install Bun: https://bun.sh"
fi

echo ""
echo "[1/6] Installing ROOT dependencies..."
if [ "$USE_BUN" = "1" ]; then
    bun install
else
    npm install
fi

echo ""
echo "[2/6] CRITICAL: Generating Prisma Client at ROOT level..."
echo "      This is required by BOTH the Next.js app AND the WebSocket mini-service."
if [ "$USE_BUN" = "1" ]; then
    bunx prisma generate
else
    npx prisma generate
fi
echo "[OK] Prisma Client generated at root."

echo ""
echo "[3/6] Installing WebSocket mini-service dependencies..."
cd mini-services/websocket
if [ "$USE_BUN" = "1" ]; then
    bun install
else
    npm install
fi
cd ../..

echo ""
echo "[4/6] Creating .env file if not exists..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[INFO] .env created from .env.example"
    echo ""
    echo "============================================"
    echo "  ACTION REQUIRED: Edit .env file"
    echo "============================================"
    echo "  Open .env and set these values:"
    echo ""
    echo "    JWT_SECRET=\"your-long-random-secret-32-chars\""
    echo "    INITIAL_ADMIN_PHONE=\"09123456789\""
    echo "    INITIAL_ADMIN_PASSWORD=\"your-strong-password\""
    echo "    STORAGE_DIR=\"/home/user/Chat-App/storage\""
    echo ""
    echo "  After editing .env, re-run this script or continue manually."
    echo "============================================"
    echo ""
    read -p "Press Enter after editing .env..."
else
    echo "[OK] .env already exists"
fi

echo ""
echo "[5/6] Setting up database (pushing schema)..."
if [ "$USE_BUN" = "1" ]; then
    bun run db:push
else
    npx prisma db push --accept-data-loss
fi

echo ""
echo "[6/6] Seeding initial admin user..."
if [ "$USE_BUN" = "1" ]; then
    bun scripts/seed.js
else
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
echo "    bun run dev      (or: npm run dev)"
echo ""
echo "Then open http://localhost:3000"
echo ""
echo "Default admin login:"
echo "  Phone: see INITIAL_ADMIN_PHONE in .env"
echo "  Password: see INITIAL_ADMIN_PASSWORD in .env"
echo ""
