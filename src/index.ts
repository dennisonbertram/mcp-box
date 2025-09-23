import 'dotenv/config';
import { InMemoryBoxClient } from './box/boxClient.js';
import { McpServer } from './server.js';
import { saveDocumentsTool } from './tools/saveDocuments.js';

const box = new InMemoryBoxClient();
const server = new McpServer({
  tools: [saveDocumentsTool],
  context: { box, env: process.env }
});

process.stdin.setEncoding('utf8');
let buffer = '';

function send(res: any) {
  process.stdout.write(JSON.stringify(res) + '\n');
}

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const req = JSON.parse(line);
      const res = await server.handle(req);
      send(res);
    } catch (e: any) {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: e?.message || 'Parse error' } });
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
