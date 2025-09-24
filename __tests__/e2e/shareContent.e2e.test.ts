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

describe('share content e2e', () => {
  test('create shared link + add collaborator', async () => {
    const save = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'box_save_documents', arguments: { documents: [{ content: 'hi', path: 'E2E4/a.txt' }], options: { createFolders: true } } } };
    const share = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'box_share_content', arguments: { items: [{ path: 'E2E4/a.txt', itemType: 'file' }], shareMethod: 'both', linkSettings: { access: 'company' }, collaborators: [{ email: 'demo@example.com', role: 'viewer', notify: true }] } } };
    const [r1, r2] = await runServerSession([save, share]);
    expect(r1.result.success).toBe(true);
    expect(r2.result.success).toBe(true);
    expect(r2.result.results[0].sharedLink).toBeTruthy();
    expect(r2.result.results[0].collaborators[0].email).toBe('demo@example.com');
  });
});

