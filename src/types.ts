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
  resolveFolderPath(path: string): Promise<string | null>;
  listFolderItems(folderId: string): Promise<readonly { id: string; name: string; type: 'file' | 'folder'; size?: number; modified?: string }[]>;
  moveFolder(folderId: string, newParentId: string): Promise<void>;
  renameFolder(folderId: string, newName: string): Promise<void>;
  deleteFolder(folderId: string, recursive?: boolean): Promise<void>;
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
