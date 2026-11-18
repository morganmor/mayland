import { defineConfig, type Plugin, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WORKSPACE_STORE_DIR = path.join(os.homedir(), '.mayland');
const WORKSPACE_STORE_FILE = path.join(WORKSPACE_STORE_DIR, 'workspace-state.json');

interface DiskWorkspaceRecord {
  rev: number;
  updatedAt: number;
  state: unknown;
}

function readDiskWorkspace(): DiskWorkspaceRecord {
  try {
    if (!fs.existsSync(WORKSPACE_STORE_FILE)) {
      return { rev: 0, updatedAt: 0, state: null };
    }
    const raw = fs.readFileSync(WORKSPACE_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DiskWorkspaceRecord>;
    return {
      rev: typeof parsed.rev === 'number' ? parsed.rev : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      state: parsed.state ?? null,
    };
  } catch {
    return { rev: 0, updatedAt: 0, state: null };
  }
}

function writeDiskWorkspace(record: DiskWorkspaceRecord): void {
  fs.mkdirSync(WORKSPACE_STORE_DIR, { recursive: true, mode: 0o700 });
  const tmpFile = `${WORKSPACE_STORE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(record, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(tmpFile, WORKSPACE_STORE_FILE);
}

function resolveLanUrls(req: IncomingMessage): string[] {
  const hostHeader = String(req.headers.host ?? '');
  const portMatch = /:(\d+)$/.exec(hostHeader);
  const port = portMatch?.[1] ?? String(req.socket.localPort || 5173);
  const urls: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const info of entries ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        urls.push(`http://${info.address}:${port}`);
      }
    }
  }
  return Array.from(new Set(urls));
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function attachCorsProxy(middlewares: Connect.Server): void {
  middlewares.use('/__mayland_proxy', async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Mayland-Proxy', '1');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
    const target = reqUrl.searchParams.get('target');
    if (!target) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Missing target URL parameter.' } }));
      return;
    }

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(target);
      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Invalid proxy target URL.' } }));
      return;
    }

    const ac = new AbortController();
    const handleClose = () => {
      if (!res.writableEnded) {
        ac.abort();
      }
    };
    res.on('close', handleClose);

    try {
      const forwardHeaders: Record<string, string> = {};
      const blocked = new Set([
        'host',
        'origin',
        'referer',
        'connection',
        'content-length',
        'accept-encoding',
      ]);
      for (const [k, v] of Object.entries(req.headers)) {
        if (!v || blocked.has(k.toLowerCase())) continue;
        forwardHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
      }

      const method = (req.method ?? 'GET').toUpperCase();
      const body =
        method === 'GET' || method === 'HEAD'
          ? undefined
          : new Uint8Array(await readRequestBody(req));

      const upstream = await fetch(parsedTarget.toString(), {
        method,
        headers: forwardHeaders,
        body,
        signal: ac.signal,
      });

      res.statusCode = upstream.status;
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-cache');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (!res.writableEnded) res.end();
        return;
      }
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: {
              message: `Proxy could not reach ${parsedTarget.host}: ${(err as Error).message}`,
            },
          })
        );
      } else if (!res.writableEnded) {
        res.end();
      }
    } finally {
      res.off('close', handleClose);
    }
  });
}

function attachWorkspaceStore(middlewares: Connect.Server): void {
  middlewares.use('/__mayland_store', async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
    const metaOnly = reqUrl.searchParams.get('meta') === '1';

    if (req.method === 'GET') {
      const record = readDiskWorkspace();
      const lanUrls = metaOnly ? undefined : resolveLanUrls(req);
      res.statusCode = 200;
      res.end(
        JSON.stringify(
          metaOnly
            ? {
                rev: record.rev,
                updatedAt: record.updatedAt,
                hasState: Boolean(record.state),
              }
            : {
                rev: record.rev,
                updatedAt: record.updatedAt,
                state: record.state,
                storePath: WORKSPACE_STORE_FILE,
                lanUrls,
              }
        )
      );
      return;
    }

    if (req.method === 'POST') {
      try {
        const bodyBuf = await readRequestBody(req);
        const body = JSON.parse(bodyBuf.toString('utf8')) as {
          state?: unknown;
        };
        if (!body || typeof body !== 'object' || !body.state) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: { message: 'Missing state payload.' } }));
          return;
        }
        const current = readDiskWorkspace();
        const nextRecord: DiskWorkspaceRecord = {
          rev: current.rev + 1,
          updatedAt: Date.now(),
          state: body.state,
        };
        writeDiskWorkspace(nextRecord);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            rev: nextRecord.rev,
            updatedAt: nextRecord.updatedAt,
            storePath: WORKSPACE_STORE_FILE,
          })
        );
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: { message: (err as Error).message } }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: { message: 'Method not allowed' } }));
  });
}

function attachWebFetchEndpoint(middlewares: Connect.Server): void {
  middlewares.use('/__mayland_webfetch', async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    let rawUrl = '';
    try {
      const reqUrl = new URL(req.url ?? '/', 'http://localhost');
      rawUrl = reqUrl.searchParams.get('url') ?? '';
      if (!rawUrl && req.method === 'POST') {
        const buf = await readRequestBody(req);
        const body = JSON.parse(buf.toString('utf8')) as { url?: string };
        rawUrl = body?.url ?? '';
      }
    } catch {
      rawUrl = '';
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http:// and https:// URLs are supported.');
      }
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host.startsWith('127.') ||
        host === '169.254.169.254' ||
        host === '::1'
      ) {
        throw new Error('Local/metadata addresses are blocked for Web Fetch.');
      }
    } catch (err) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          ok: false,
          error: (err as Error).message || 'Invalid URL.',
        })
      );
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mayland-WebFetch/1.0 (+https://mayland.app)',
          Accept:
            'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5',
        },
        signal: AbortSignal.timeout(12000),
      });

      const contentType = upstream.headers.get('content-type') ?? 'text/plain';
      const rawText = await upstream.text();
      const body = rawText.slice(0, 1_500_000);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: upstream.ok,
          status: upstream.status,
          url: parsed.toString(),
          finalUrl: upstream.url || parsed.toString(),
          contentType,
          body,
        })
      );
    } catch (err) {
      res.statusCode = 502;
      res.end(
        JSON.stringify({
          ok: false,
          url: parsed.toString(),
          error: `Web fetch failed: ${(err as Error).message}`,
        })
      );
    }
  });
}

function maylandLocalProxyPlugin(): Plugin {
  return {
    name: 'mayland-local-proxy',
    configureServer(server) {
      attachCorsProxy(server.middlewares);
      attachWorkspaceStore(server.middlewares);
      attachWebFetchEndpoint(server.middlewares);
    },
    configurePreviewServer(server) {
      attachCorsProxy(server.middlewares);
      attachWorkspaceStore(server.middlewares);
      attachWebFetchEndpoint(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), maylandLocalProxyPlugin()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/adapters/modelsDev')) {
            return 'catalog-models';
          }
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (
              id.includes('react-markdown') ||
              id.includes('remark') ||
              id.includes('unified') ||
              id.includes('mdast') ||
              id.includes('micromark') ||
              id.includes('hast') ||
              id.includes('unist') ||
              id.includes('vfile')
            ) {
              return 'vendor-markdown';
            }
            if (id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'vendor-motion';
            }
            if (
              id.includes('react-dom') ||
              id.includes('\\react\\') ||
              id.includes('/react/') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
          }
          return undefined;
        },
      },
    },
  }
});
