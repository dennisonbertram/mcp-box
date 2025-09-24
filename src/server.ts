import { ToolDefinition, ToolContext, JsonRpcRequest, JsonRpcResponse } from './types.js';

interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

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

  listResources(): Resource[] {
    return [
      {
        uri: "box://file/{fileId}",
        name: "Box File",
        description: "Access to a specific Box file by ID",
        mimeType: "application/json"
      },
      {
        uri: "box://folder/{folderId}",
        name: "Box Folder",
        description: "Access to a specific Box folder by ID",
        mimeType: "application/json"
      },
      {
        uri: "box://search?q={query}",
        name: "Box Search",
        description: "Search Box content with query parameters",
        mimeType: "application/json"
      },
      {
        uri: "box://user/storage",
        name: "Box Storage Info",
        description: "Current user's Box storage quota and usage",
        mimeType: "application/json"
      },
      {
        uri: "box://user/recent",
        name: "Recent Files",
        description: "Recently accessed files in Box",
        mimeType: "application/json"
      },
      {
        uri: "box://folder/root/tree",
        name: "Root Folder Tree",
        description: "Complete folder structure from root",
        mimeType: "application/json"
      }
    ];
  }

  listPrompts(): Prompt[] {
    return [
      {
        name: "share_file",
        description: "Create a shared link for a Box file with customizable permissions",
        arguments: [
          { name: "fileId", description: "Box file ID to share", required: true },
          { name: "access", description: "Access level (open, company, collaborators)", required: false },
          { name: "password", description: "Optional password protection", required: false },
          { name: "expiresAt", description: "Optional expiration date (YYYY-MM-DD)", required: false }
        ]
      },
      {
        name: "analyze_document",
        description: "Use Box AI to analyze a document with specific questions or tasks",
        arguments: [
          { name: "fileId", description: "Box file ID to analyze", required: true },
          { name: "analysisType", description: "Type of analysis (summarize, extract, qa)", required: true },
          { name: "prompt", description: "Specific question or analysis request", required: false },
          { name: "focus", description: "Specific aspects to focus on", required: false }
        ]
      },
      {
        name: "organize_folder",
        description: "Organize files in a folder by creating subfolders and moving files",
        arguments: [
          { name: "folderId", description: "Box folder ID to organize", required: true },
          { name: "strategy", description: "Organization strategy (by_date, by_type, by_name)", required: true },
          { name: "createSubfolders", description: "Whether to create subfolders", required: false }
        ]
      },
      {
        name: "bulk_upload",
        description: "Upload multiple files to Box with folder organization",
        arguments: [
          { name: "targetFolder", description: "Target folder path or ID", required: true },
          { name: "createFolders", description: "Auto-create folder structure", required: false },
          { name: "classification", description: "Security classification for files", required: false }
        ]
      },
      {
        name: "collaboration_setup",
        description: "Set up collaboration on a Box file or folder with specific users",
        arguments: [
          { name: "itemId", description: "Box file or folder ID", required: true },
          { name: "itemType", description: "Item type (file or folder)", required: true },
          { name: "collaborators", description: "Comma-separated list of email addresses", required: true },
          { name: "role", description: "Collaboration role (viewer, editor, owner)", required: true }
        ]
      }
    ];
  }

  async getPrompt(name: string, args?: Record<string, any>): Promise<any> {
    switch (name) {
      case "share_file":
        return this.generateShareFilePrompt(args || {});
      case "analyze_document":
        return this.generateAnalyzeDocumentPrompt(args || {});
      case "organize_folder":
        return this.generateOrganizeFolderPrompt(args || {});
      case "bulk_upload":
        return this.generateBulkUploadPrompt(args || {});
      case "collaboration_setup":
        return this.generateCollaborationSetupPrompt(args || {});
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  private generateShareFilePrompt(args: Record<string, any>) {
    const { fileId, access = 'company', password, expiresAt } = args;

    let prompt = `Create a shared link for Box file ${fileId} with the following settings:\n`;
    prompt += `- Access level: ${access}\n`;
    if (password) prompt += `- Password protected: ${password}\n`;
    if (expiresAt) prompt += `- Expires on: ${expiresAt}\n`;
    prompt += `\nUse the box_update_shared_link tool to create or update the shared link with these settings.`;

    return {
      description: "Prompt to create a shared link for a Box file",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: prompt
          }
        }
      ]
    };
  }

  private generateAnalyzeDocumentPrompt(args: Record<string, any>) {
    const { fileId, analysisType = 'summarize', prompt: userPrompt, focus } = args;

    let instruction = `Use Box AI to ${analysisType} the document with file ID ${fileId}.\n`;
    if (userPrompt) instruction += `Specific request: ${userPrompt}\n`;
    if (focus) instruction += `Focus on: ${focus}\n`;
    instruction += `\nUse the box_analyze_document tool with the appropriate analysis type and parameters.`;

    return {
      description: "Prompt to analyze a Box document using AI",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: instruction
          }
        }
      ]
    };
  }

  private generateOrganizeFolderPrompt(args: Record<string, any>) {
    const { folderId, strategy = 'by_type', createSubfolders = true } = args;

    let instruction = `Organize the files in Box folder ${folderId} using the "${strategy}" strategy.\n`;
    if (createSubfolders) instruction += `Create subfolders as needed for organization.\n`;
    instruction += `\nFirst use box_explore_storage to see the current folder structure, then use box_manage_folders to reorganize as needed.`;

    return {
      description: "Prompt to organize files in a Box folder",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: instruction
          }
        }
      ]
    };
  }

  private generateBulkUploadPrompt(args: Record<string, any>) {
    const { targetFolder, createFolders = true, classification } = args;

    let instruction = `Upload multiple files to Box folder: ${targetFolder}\n`;
    if (createFolders) instruction += `Automatically create folder structure as needed.\n`;
    if (classification) instruction += `Apply security classification: ${classification}\n`;
    instruction += `\nUse the box_save_documents tool with appropriate folder creation and metadata settings.`;

    return {
      description: "Prompt for bulk file upload to Box",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: instruction
          }
        }
      ]
    };
  }

  private generateCollaborationSetupPrompt(args: Record<string, any>) {
    const { itemId, itemType = 'file', collaborators, role = 'editor' } = args;

    let instruction = `Set up collaboration on Box ${itemType} ${itemId}:\n`;
    instruction += `- Add collaborators: ${collaborators}\n`;
    instruction += `- Role: ${role}\n`;
    instruction += `\nUse the box_update_collaborators tool to add these collaborators with the specified role.`;

    return {
      description: "Prompt to set up collaboration on a Box item",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: instruction
          }
        }
      ]
    };
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
          // Build compliant result with full MCP capabilities
          const initResult = {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: { name: 'box-mcp-server', version: '0.1.0' }
          };
          return { jsonrpc: '2.0', id, result: initResult };
        case 'tools/list': {
          const result = { tools: this.listTools() };
          return { jsonrpc: '2.0', id, result };
        }
        case 'resources/list': {
          const result = { resources: this.listResources() };
          return { jsonrpc: '2.0', id, result };
        }
        case 'prompts/list': {
          const result = { prompts: this.listPrompts() };
          return { jsonrpc: '2.0', id, result };
        }
        case 'prompts/get': {
          const name = req.params?.name;
          const args = req.params?.arguments;
          if (!name) {
            return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing required parameter: name' } };
          }
          const result = await this.getPrompt(String(name), args || {});
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
