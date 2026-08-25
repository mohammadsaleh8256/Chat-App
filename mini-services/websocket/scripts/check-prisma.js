/**
 * Check that the ROOT project's Prisma Client has been generated.
 * The mini-service imports PrismaClient from the root's node_modules
 * (not from a local stub). If the root client isn't generated, we
 * show a clear, actionable error message instead of the cryptic
 * "@prisma/client did not initialize yet" error.
 */
const path = require('path');
const fs = require('fs');

// Root project directory (parent of mini-services/websocket)
const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const PRISMA_CLIENT_DIR = path.join(ROOT_DIR, 'node_modules', '.prisma', 'client');
const PRISMA_CLIENT_INDEX = path.join(PRISMA_CLIENT_DIR, 'index.js');
const PRISMA_CLIENT_DEFAULT = path.join(PRISMA_CLIENT_DIR, 'default.js');

function fail(message) {
  console.error('\n========================================');
  console.error('  PRISMA CLIENT NOT GENERATED');
  console.error('========================================');
  console.error(message);
  console.error('\nTo fix this, run in the PROJECT ROOT:');
  console.error('  cd ' + ROOT_DIR);
  console.error('  npx prisma generate');
  console.error('\nThen restart the WebSocket service:');
  console.error('  cd ' + path.resolve(__dirname, '..'));
  console.error('  npm run dev');
  console.error('');
  process.exit(1);
}

// Check 1: Does the .prisma/client directory exist?
if (!fs.existsSync(PRISMA_CLIENT_DIR)) {
  fail(
    'The directory node_modules/.prisma/client does not exist in the project root.\n' +
    'This means `prisma generate` has never been run in the root project.'
  );
}

// Check 2: Does the generated client file exist and is it NOT a stub?
// The stub (default.js) is small and throws an error. The real generated
// client (index.js) is much larger and exports a working PrismaClient class.
if (!fs.existsSync(PRISMA_CLIENT_INDEX)) {
  fail(
    'The file node_modules/.prisma/client/index.js does not exist.\n' +
    'The Prisma Client was not generated. Run `npx prisma generate` in the project root.'
  );
}

// Check 3: Verify the generated client is substantial (not just the stub)
// The stub default.js is ~2KB. The real generated index.js is >50KB.
const stats = fs.statSync(PRISMA_CLIENT_INDEX);
if (stats.size < 10000) {
  fail(
    'The generated Prisma Client at node_modules/.prisma/client/index.js is too small (' +
    stats.size +
    ' bytes).\n' +
    'This indicates an incomplete generation. Run `npx prisma generate` in the project root.'
  );
}

// Check 4: Try to require it and verify PrismaClient is a real constructor
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const client = require(path.join(ROOT_DIR, 'node_modules', '@prisma', 'client'));
  if (!client.PrismaClient || typeof client.PrismaClient !== 'function') {
    fail(
      'PrismaClient is not a valid constructor in the root @prisma/client.\n' +
      'Run `npx prisma generate` in the project root.'
    );
  }
} catch (err) {
  fail(
    'Failed to load @prisma/client from the root project:\n' +
    (err && err.message ? err.message : String(err))
  );
}

console.log('[ws] Prisma Client check passed (root project).');
process.exit(0);
