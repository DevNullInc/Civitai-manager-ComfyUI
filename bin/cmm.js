#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Try requiring compiled CLI or TypeScript directly via ts-node / dist
const distCli = path.join(__dirname, '../dist/cli/index.js');

async function main() {
  let cliModule;
  if (fs.existsSync(distCli)) {
    cliModule = require(distCli);
  } else {
    const { execSync } = require('child_process');
    try {
      execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      if (fs.existsSync(distCli)) {
        cliModule = require(distCli);
      }
    } catch (e) {
      console.error('Error compiling CMM CLI:', e);
      process.exit(1);
    }
  }

  if (cliModule && typeof cliModule.runCli === 'function') {
    const code = await cliModule.runCli(process.argv.slice(2));
    process.exit(code || 0);
  }
}

main().catch((err) => {
  console.error('\x1b[31m[!] Fatal CLI error:\x1b[0m', err);
  process.exit(1);
});
