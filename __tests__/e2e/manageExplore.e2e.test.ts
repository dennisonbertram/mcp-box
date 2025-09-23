import path from 'node:path';
import { spawn } from 'node:child_process';

function runServerSession(inputs: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const node = process.execPath;
    const entry = path.join(process.cwd(), 'dist', 'index.js');
    const child = spawn(node, [entry], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', () => {
      try {
        const lines = out.trim().split('\n').filter(Boolean);
        const results = lines.map((l) => JSON.parse(l));
        resolve(results);
      } catch (e) {
        reject(new Error('Failed to parse server output: ' + err));
      }
    });
    for (const req of inputs) child.stdin.write(JSON.stringify(req) + '\n');
    child.stdin.end();
  });
}

describe('folders manage + explore (e2e)', () => {
  test('create folders then explore tree', async () => {
    const create = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'box_manage_folders', arguments: { action: 'create', folders: [{ path: 'E2E2/A/B' }] } } };
    const explore = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'box_explore_storage', arguments: { path: 'E2E2', options: { depth: 3, includeFiles: true } } } };
    const [r1, r2] = await runServerSession([create, explore]);
    expect(r1.result.success).toBe(true);
    expect(r2.result.success).toBe(true);
    const str = JSON.stringify(r2.result.tree);
    expect(str).toMatch(/A/);
    expect(str).toMatch(/B/);
  });
});

