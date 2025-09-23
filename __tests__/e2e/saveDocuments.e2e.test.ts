import { spawn } from 'node:child_process';
import path from 'node:path';

function runServerWith(input: any): Promise<any> {
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
        const lines = out.trim().split('\n');
        const last = JSON.parse(lines[lines.length - 1] || '{}');
        resolve(last);
      } catch (e) {
        reject(new Error('Failed to parse server output: ' + err));
      }
    });

    child.stdin.write(JSON.stringify(input) + '\n');
    child.stdin.end();
  });
}

describe('MCP stdio e2e', () => {
  test('tools/list includes box_save_documents', async () => {
    const res = await runServerWith({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.result.tools.some((t: any) => t.name === 'box_save_documents')).toBe(true);
  });

  test('tools/call box_save_documents saves a file', async () => {
    const call = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'box_save_documents',
        arguments: {
          documents: [{ content: 'hello', path: 'E2E/a.txt' }],
          options: { createFolders: true }
        }
      }
    };
    const res = await runServerWith(call);
    expect(res.result.success).toBe(true);
    expect(res.result.saved).toBe(1);
  });
});
