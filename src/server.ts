import { ToolDefinition, ToolContext, JsonRpcRequest, JsonRpcResponse } from './types.js';

export class McpServer {
  private tools: Map<string, ToolDefinition> = new Map();
  private context: ToolContext;

  constructor(opts: { tools: ToolDefinition[]; context: ToolContext }) {
    for (const t of opts.tools) this.tools.set(t.name, t);
    this.context = opts.context;
  }

  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
  }

  async callTool(name: string, args: any) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return await tool.handler(args ?? {}, this.context);
  }

  async handle(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req.id ?? null;
    try {
      switch (req.method) {
        case 'initialize':
          // Build compliant result
          const initResult = {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'box-mcp-server', version: '0.1.0' }
          };
          return { jsonrpc: '2.0', id, result: initResult };
        case 'tools/list': {
          const result = { tools: this.listTools() };
          return { jsonrpc: '2.0', id, result };
        }
        case 'tools/call': {
          const name = req.params?.name;
          const args = req.params?.arguments ?? {};
          const raw = await this.callTool(String(name), args);
          // Ensure result conforms to CallToolResultSchema; wrap as text content otherwise
          let result: any;
          result = { content: [{ type: 'text', text: JSON.stringify(raw) }], ...raw };
          return { jsonrpc: '2.0', id, result };
        }
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
      }
    } catch (err: any) {
      return { jsonrpc: '2.0', id, error: { code: -32000, message: err?.message || 'Server error' } };
    }
  }
}
