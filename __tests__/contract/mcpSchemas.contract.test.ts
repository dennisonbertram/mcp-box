import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let InitializeResultSchema: any, ListToolsResultSchema: any, CallToolResultSchema: any;

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

describe('MCP schema compliance', () => {
  test('initialize, tools/list, tools/call validate against schemas', async () => {
    const pkg = require.resolve('@modelcontextprotocol/sdk/package.json');
    const distDir = path.resolve(path.dirname(pkg), '..');
    const typesPath = path.join(distDir, 'esm/types.js');
    const types = await import(pathToFileURL(typesPath).href);
    InitializeResultSchema = types.InitializeResultSchema;
    ListToolsResultSchema = types.ListToolsResultSchema;
    CallToolResultSchema = types.CallToolResultSchema;
    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        clientInfo: { name: 'test-client', version: '0.0.0' }
      }
    };
    const list = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
    const save = {
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
        name: 'box_save_documents',
        arguments: { documents: [{ content: 'abc', path: 'Contract/x.txt' }], options: { createFolders: true } }
      }
    };
    const [rInit, rList, rSave] = await runServerSession([initialize, list, save]);
    expect(InitializeResultSchema.safeParse(rInit.result).success).toBe(true);
    expect(ListToolsResultSchema.safeParse(rList.result).success).toBe(true);
    expect(CallToolResultSchema.safeParse(rSave.result).success).toBe(true);
  });
});
