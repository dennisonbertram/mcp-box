import type { ToolDefinition, ToolContext } from '../types.js';

export const updateSharedLinkTool: ToolDefinition = {
  name: 'box_update_shared_link',
  description: 'Update shared link settings for a file or folder',
  inputSchema: {
    type: 'object',
    properties: {
      itemType: { type: 'string', enum: ['file', 'folder'] },
      itemId: { type: 'string' },
      path: { type: 'string' },
      access: { type: 'string', enum: ['open', 'company', 'collaborators'] },
      password: { type: 'string' },
      canDownload: { type: 'boolean' },
      unsharedAt: { type: 'string' }
    },
    anyOf: [ { required: ['itemId','itemType'] }, { required: ['path','itemType'] } ]
  },
  outputSchema: {
    type: 'object',
    properties: { url: { type: 'string' }, access: { type: 'string' }, unsharedAt: { type: 'string' } }
  },
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
      const res = await (context.box as any).updateSharedLink({ itemType: args.itemType, itemId, access: args.access, password: args.password ?? null, canDownload: args.canDownload, unsharedAt: args.unsharedAt ?? null });
      return { success: true, structuredContent: res };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
};

export default updateSharedLinkTool;
