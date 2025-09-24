import { ToolDefinition, ToolContext, JsonRpcRequest, JsonRpcResponse } from './types.js';

export class McpServer {
  private tools: Map<string, ToolDefinition> = new Map();
  private context: ToolContext;
  private validators: Map<string, any> = new Map();

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
    // Validate input against JSON Schema if available
    if (tool.inputSchema) {
      const AjvMod: any = await import('ajv');
      const Ajv = AjvMod.default || AjvMod;
      let validate = this.validators.get(tool.name);
      if (!validate) {
        const ajv = new Ajv({ allErrors: true, strict: false });
        validate = ajv.compile(tool.inputSchema);
        this.validators.set(tool.name, validate);
      }
      const ok = validate(args);
      if (!ok) {
        const errors = (validate.errors || []).map((e: any) => `${e.instancePath || '(root)'} ${e.message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: `Invalid arguments for ${tool.name}:\n` + errors.join('\n') }],
          structuredContent: { errors }
        };
      }
    }
    return await tool.handler(args ?? {}, this.context);
  }

  async handle(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req.id ?? null;
    try {
      switch (req.method) {
        case 'initialize':
          // Build compliant result
          const initResult = {
            protocolVersion: '2025-06-18',
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
          // Build result with content + optional structuredContent
          const structured = raw?.structuredContent;
          let text: string;
          if (raw?.isError && Array.isArray(raw?.content) && raw.content[0]?.text) {
            text = String(raw.content[0].text);
          } else if (structured) {
            text = JSON.stringify(structured);
          } else {
            text = JSON.stringify({ ...raw, content: undefined, structuredContent: undefined });
          }
          const extra: any = { ...raw };
          delete extra.content; delete extra.structuredContent;
          if (structured && typeof structured === 'object') {
            const aliases = ['totalResults','results','tree','path','analysisType','answer','citations','fields','targetLanguage','file','text'];
            for (const k of aliases) {
              if (structured[k] !== undefined && extra[k] === undefined) extra[k] = structured[k];
            }
            // Back-compat alias for readDocument: text -> content
            if (structured['text'] && extra['content'] === undefined) extra['content'] = structured['text'];
          }
          const result: any = {
            content: [{ type: 'text', text }],
            ...(structured ? { structuredContent: structured } : {}),
            ...(raw?.isError ? { isError: true } : {}),
            ...extra
          };
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
