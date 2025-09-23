export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ToolHandler = (args: any, context: ToolContext) => Promise<any>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: ToolHandler;
}

export interface ToolContext {
  box: BoxClient;
  env: Record<string, string | undefined>;
}

export interface BoxClient {
  ensureFolderPath(path: string, description?: string): Promise<string>;
  checkFileExists(parentId: string, fileName: string): Promise<{ id: string; size: number } | null>;
  uploadFile(parentId: string, fileName: string, content: Buffer): Promise<{ id: string; size: number }>;
  getFileByPath(path: string): Promise<{ id: string; name: string; size: number; content: Buffer } | null>;
  getFileContent(fileId: string): Promise<Buffer>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}
