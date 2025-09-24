import type { ToolDefinition, ToolContext } from '../types.js';

async function handle(args: any, context: ToolContext) {
  try {
    let fileId: string | undefined = args.fileId;
    if (!fileId && args.path) {
      const file = await context.box.getFileByPath(args.path);
      if (!file) throw new Error(`Path not found: ${args.path}`);
      fileId = file.id;
    }
    if (!fileId) throw new Error('fileId or path is required');

    const content = await context.box.getFileContent(fileId);
    const asText = args.options?.asText !== false;
    const body = asText ? content.toString('utf8') : content.toString('base64');

    return {
      success: true,
      structuredContent: {
        file: { id: fileId },
        text: body
      },
      content: body
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export const readDocumentTool: ToolDefinition = {
  name: 'box_read_document',
  description: 'Read document content without saving locally',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Box file ID to read' },
      path: { type: 'string', description: 'Box file path to read (alternative to fileId)' },
      options: {
        type: 'object',
        properties: {
          asText: { type: 'boolean', default: true, description: 'Return content as text (true) or base64 (false)' }
        }
      }
    },
    required: ['fileId']
  },
  outputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          extension: { type: 'string' },
          size: { type: 'number' }
        }
      },
      text: { type: 'string' }
    }
  },
  handler: handle
};

export default readDocumentTool;
