/**
 * Vitest globalSetup for browser mode.
 *
 * Spawns a tiny static HTTP server rooted at `public/menu-preview/` and
 * stashes its URL in `process.env.PREVIEW_URL` so the browser-mode test
 * suite can `page.goto()` it. Browser tests cannot start Node servers
 * themselves (Node APIs are externalised in the browser bundle), so the
 * boot must happen here in Node.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
// Serve from public/ so the absolute script srcs in index.html
// (`/menu-preview/runtime.js`, `/menu-preview/base.css`, etc.) resolve.
const publicDir = path.join(repoRoot, 'public')

let server: ChildProcess | null = null

export async function setup(): Promise<void> {
  server = spawn(
    process.execPath,
    [
      '-e',
      `
        const http = require('http');
        const fs = require('fs');
        const path = require('path');
        const root = ${JSON.stringify(publicDir)};
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
        const server = http.createServer((req, res) => {
          const url = (req.url || '/').split('?')[0];
          const file = path.join(root, url === '/' ? '/index.html' : url);
          if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
          fs.readFile(file, (err, buf) => {
            if (err) { res.statusCode = 404; return res.end(); }
            res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
            res.end(buf);
          });
        });
        server.listen(39573, '127.0.0.1', () => {
          process.stdout.write('url=http://127.0.0.1:39573/index.html\\n');
        });
      `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )

  await new Promise<void>((resolve, reject) => {
    let buf = ''
    const onData = (chunk: Buffer) => {
      buf += chunk.toString()
      const m = buf.match(/url=(http:\/\/[^\s]+)/)
      if (m) {
        server?.stdout?.off('data', onData)
        process.env.PREVIEW_URL = m[1]
        resolve()
      }
    }
    server?.stdout?.on('data', onData)
    server?.on('error', reject)
    setTimeout(() => reject(new Error('preview server boot timeout')), 5000)
  })
}

export async function teardown(): Promise<void> {
  if (server && !server.killed) {
    server.kill('SIGTERM')
  }
}
