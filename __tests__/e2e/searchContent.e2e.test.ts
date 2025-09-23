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

describe('search e2e', () => {
  test('search finds expected file', async () => {
    const saveA = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'box_save_documents', arguments: { documents: [{ content: 'alpha text', path: 'E2E3/A/a.txt' }], options: { createFolders: true } } } };
    const saveB = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'box_save_documents', arguments: { documents: [{ content: 'beta text', path: 'E2E3/B/b.pdf' }], options: { createFolders: true } } } };
    const search = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'box_search_content', arguments: { query: 'alpha', filters: { type: 'file', extensions: ['txt'] }, options: { limit: 5 } } } };
    const [, , r3] = await runServerSession([saveA, saveB, search]);
    expect(r3.result.success).toBe(true);
    expect(r3.result.totalResults).toBeGreaterThanOrEqual(1);
    expect(r3.result.results[0].name).toBe('a.txt');
  });
});

