import 'dotenv/config';
import { createBoxClient } from './box/factory.js';
import { McpServer } from './server.js';
import { saveDocumentsTool } from './tools/saveDocuments.js';
import { readDocumentTool } from './tools/readDocument.js';
import { manageFoldersTool } from './tools/manageFolders.js';
import { exploreStorageTool } from './tools/exploreStorage.js';
import { searchContentTool } from './tools/searchContent.js';

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
      // Lazy boot to ensure client ready
      if (!(globalThis as any).__server) {
        (globalThis as any).__server = await (async () => {
          const box = await createBoxClient(process.env);
          return new McpServer({ tools: [saveDocumentsTool, readDocumentTool, manageFoldersTool, exploreStorageTool, searchContentTool], context: { box, env: process.env } });
        })();
      }
      const srv = (globalThis as any).__server as McpServer;
      const res = await srv.handle(req);
      send(res);
    } catch (e: any) {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: e?.message || 'Parse error' } });
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
