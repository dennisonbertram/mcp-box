import { spawn } from 'node:child_process';
import http from 'node:http';

function postRpc(port: number, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/rpc', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d.toString()));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

describe('MCP HTTP transport', () => {
  test('tools/list and a save call', async () => {
    const node = process.execPath;
    const child = spawn(node, ['dist/index.js'], { env: { ...process.env, MCP_TRANSPORT: 'http', MCPSERVER_PORT: '0' } });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for listen')), 3000);
      child.stdout.on('data', () => {
        if (/MCP HTTP listening on :\d+/.test(out)) {
          clearTimeout(t);
          resolve();
        }
      });
    });
    const m = out.match(/MCP HTTP listening on :(\d+)/);
    const port = Number(m?.[1] || 0);
    expect(port).toBeGreaterThan(0);

    const listRes = await postRpc(port, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(Array.isArray(listRes.result.tools)).toBe(true);

    const saveRes = await postRpc(port, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'box_save_documents', arguments: { documents: [{ content: 'x', path: 'HTTP/a.txt' }], options: { createFolders: true } } } });
    expect(saveRes.result.success).toBe(true);

    child.kill();
  });
});

