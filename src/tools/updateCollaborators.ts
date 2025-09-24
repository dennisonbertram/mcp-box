import type { ToolDefinition, ToolContext } from '../types.js';

export const updateCollaboratorsTool: ToolDefinition = {
  name: 'box_update_collaborators',
  description: 'Update collaborator roles or remove collaborators on a file/folder',
  inputSchema: {
    type: 'object',
    properties: {
      itemType: { type: 'string', enum: ['file', 'folder'] },
      itemId: { type: 'string' },
      path: { type: 'string' },
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string' },
            remove: { type: 'boolean' }
          },
          required: ['email']
        }
      }
    },
    anyOf: [ { required: ['itemId','itemType','updates'] }, { required: ['path','itemType','updates'] } ]
  },
  outputSchema: { type: 'object', properties: { updated: { type: 'array', items: { type: 'object' } } }, required: ['updated'] },
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
      const res = await (context.box as any).updateCollaborators({ itemType: args.itemType, itemId, updates: args.updates });
      return { success: true, structuredContent: res };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
};

export default updateCollaboratorsTool;
