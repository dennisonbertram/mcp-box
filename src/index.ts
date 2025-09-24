import 'dotenv/config';
import { createBoxClient } from './box/factory.js';
import { McpServer } from './server.js';
import { saveDocumentsTool } from './tools/saveDocuments.js';
import { readDocumentTool } from './tools/readDocument.js';
import { manageFoldersTool } from './tools/manageFolders.js';
import { exploreStorageTool } from './tools/exploreStorage.js';
import { searchContentTool } from './tools/searchContent.js';
import { shareContentTool } from './tools/shareContent.js';
import { analyzeDocumentTool } from './tools/analyzeDocument.js';
import { updateSharedLinkTool } from './tools/updateSharedLink.js';
import { removeSharedLinkTool } from './tools/removeSharedLink.js';
import { updateCollaboratorsTool } from './tools/updateCollaborators.js';

const transport = process.env.MCP_TRANSPORT || 'stdio';

if (transport === 'http') {
  // Minimal HTTP JSON-RPC endpoint + SSE keepalive
  const http = await import('node:http');
  const server = http.createServer(async (req, res) => {
    const requiredToken = process.env.AUTH_TOKEN || process.env.MCP_BEARER_TOKEN;
    const okAuth = () => {
      if (!requiredToken) return true;
      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer ')) return false;
      const tok = auth.slice('Bearer '.length);
      return tok === requiredToken;
    };
    if (req.method === 'POST' && (req.url === '/' || req.url === '/rpc' || req.url === '/mcp')) {
      if (!okAuth()) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          if (!(globalThis as any).__server) {
            const box = await createBoxClient(process.env);
            (globalThis as any).__server = new McpServer({ tools: [saveDocumentsTool, readDocumentTool, manageFoldersTool, exploreStorageTool, searchContentTool, shareContentTool, analyzeDocumentTool, updateSharedLinkTool, removeSharedLinkTool, updateCollaboratorsTool], context: { box, env: process.env } });
          }
          const srv = (globalThis as any).__server as McpServer;
          const result = await srv.handle(data);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(400);
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: err?.message || 'Parse error' } }));
        }
      });
      return;
    }
    if (req.method === 'GET' && (req.url === '/events' || req.url === '/sse')) {
      if (!okAuth()) {
        res.writeHead(401);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write(`event: ping\n` + `data: ${Date.now()}\n\n`);
      const t = setInterval(() => {
        res.write(`event: ping\n` + `data: ${Date.now()}\n\n`);
      }, 15000);
      req.on('close', () => clearInterval(t));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
  const port = Number(process.env.MCPSERVER_PORT || 0);
  server.listen(port, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
    console.log(`MCP HTTP listening on :${actualPort}`);
  });
} else {
  // stdio transport
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
        if (!(globalThis as any).__server) {
          const box = await createBoxClient(process.env);
          (globalThis as any).__server = new McpServer({ tools: [saveDocumentsTool, readDocumentTool, manageFoldersTool, exploreStorageTool, searchContentTool, shareContentTool, analyzeDocumentTool, updateSharedLinkTool, removeSharedLinkTool, updateCollaboratorsTool], context: { box, env: process.env } });
        }
        const srv = (globalThis as any).__server as McpServer;
        const resObj = await srv.handle(req);
        send(resObj);
      } catch (e: any) {
        send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: e?.message || 'Parse error' } });
      }
    }
  });
  process.stdin.on('end', () => process.exit(0));
}
