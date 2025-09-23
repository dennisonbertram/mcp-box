import type { ToolDefinition, ToolContext } from '../types.js';

function parsePath(p: string) {
  const parts = p.split('/');
  const fileName = parts.pop() || '';
  const folderPath = parts.filter(Boolean).join('/');
  return { folderPath, fileName };
}

async function getContent(doc: any): Promise<Buffer> {
  if (typeof doc.content === 'string') {
    if (doc.content.includes('base64,')) {
      const base64Data = doc.content.split('base64,')[1] ?? doc.content;
      return Buffer.from(base64Data, 'base64');
    }
    return Buffer.from(doc.content, 'utf8');
  }
  throw new Error('No content provided');
}

async function handle(args: any, context: ToolContext) {
  const results: any[] = [];
  const overwrite = Boolean(args.options?.overwrite);
  const createFolders = args.options?.createFolders !== false;

  for (const doc of args.documents ?? []) {
    try {
      const { folderPath, fileName } = parsePath(doc.path);
      if (!fileName) throw new Error('Missing filename in path');

      let parentId = '0';
      if (folderPath && createFolders) {
        parentId = await context.box.ensureFolderPath(folderPath);
      }

      const content = await getContent(doc);
      if (!overwrite) {
        const exists = await context.box.checkFileExists(parentId, fileName);
        if (exists) {
          results.push({ path: doc.path, success: false, error: 'File already exists' });
          continue;
        }
      }

      const uploaded = await context.box.uploadFile(parentId, fileName, content);
      results.push({ path: doc.path, success: true, fileId: uploaded.id, size: uploaded.size });
    } catch (err: any) {
      results.push({ path: doc.path, success: false, error: err?.message || String(err) });
    }
  }

  return {
    success: results.every((r) => r.success),
    saved: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results
  };
}

export const saveDocumentsTool: ToolDefinition = {
  name: 'box_save_documents',
  description: 'Save multiple documents to Box storage with automatic folder creation',
  inputSchema: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            path: { type: 'string' }
          },
          required: ['path'],
          oneOf: [
            { required: ['content'] }
          ]
        }
      },
      options: {
        type: 'object',
        properties: {
          overwrite: { type: 'boolean', default: false },
          createFolders: { type: 'boolean', default: true }
        }
      }
    },
    required: ['documents']
  },
  handler: handle
};

export default saveDocumentsTool;
