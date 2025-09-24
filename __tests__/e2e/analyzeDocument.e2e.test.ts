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

describe('analyze e2e', () => {
  test('summarize and qa', async () => {
    const save = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'box_save_documents', arguments: { documents: [{ content: 'Hello world. MCP and Box.', path: 'E2E5/doc.txt' }], options: { createFolders: true } } } };
    const sum = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'box_analyze_document', arguments: { path: 'E2E5/doc.txt', analysisType: 'summarize' } } };
    const qa = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'box_analyze_document', arguments: { path: 'E2E5/doc.txt', analysisType: 'qa', question: 'What is mentioned?' } } };
    const [r1, r2, r3] = await runServerSession([save, sum, qa]);
    expect(r1.result.success).toBe(true);
    expect(r2.result.success).toBe(true);
    expect(r2.result.answer).toMatch(/Summary/);
    expect(r3.result.success).toBe(true);
    expect(r3.result.answer).toMatch(/Q:/);
  });
});

