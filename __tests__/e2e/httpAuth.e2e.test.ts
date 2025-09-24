import { spawn } from 'node:child_process';
import http from 'node:http';

function postRpc(port: number, payload: any, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/rpc', method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d.toString()));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode || 0, body: null });
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

describe('HTTP Bearer auth', () => {
  test('401 without token, 200 with token', async () => {
    const node = process.execPath;
    const child = spawn(node, ['dist/index.js'], { env: { ...process.env, MCP_TRANSPORT: 'http', MCPSERVER_PORT: '0', AUTH_TOKEN: 'testtoken' } });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting')), 3000);
      child.stdout.on('data', () => { if (/MCP HTTP listening on :\d+/.test(out)) { clearTimeout(t); resolve(); } });
    });
    const m = out.match(/:(\d+)/);
    const port = Number(m?.[1] || 0);
    const payload = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    const r1 = await postRpc(port, payload);
    expect(r1.status).toBe(401);
    const r2 = await postRpc(port, payload, 'testtoken');
    expect(r2.status).toBe(200);
    child.kill();
  });
});

