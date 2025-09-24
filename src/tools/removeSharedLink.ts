import type { ToolDefinition, ToolContext } from '../types.js';

export const removeSharedLinkTool: ToolDefinition = {
  name: 'box_remove_shared_link',
  description: 'Remove shared link from a file or folder',
  inputSchema: {
    type: 'object',
    properties: {
      itemType: { type: 'string', enum: ['file', 'folder'] },
      itemId: { type: 'string' },
      path: { type: 'string' }
    },
    anyOf: [ { required: ['itemId','itemType'] }, { required: ['path','itemType'] } ]
  },
  outputSchema: { type: 'object', properties: { removed: { type: 'boolean' } }, required: ['removed'] },
  handler: async (args: any, context: ToolContext) => {
    try {
      let itemId = args.itemId;
      if (!itemId && args.path) {
        if (args.itemType === 'folder') {
          const id = await context.box.resolveFolderPath(args.path);
          if (!id) throw new Error('Folder not found');
          itemId = id;
        } else {
          const f = await context.box.getFileByPath(args.path);
          if (!f) throw new Error('File not found');
          itemId = f.id;
        }
      }
      const res = await (context.box as any).removeSharedLink({ itemType: args.itemType, itemId });
      return { success: true, structuredContent: res };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
};

export default removeSharedLinkTool;
