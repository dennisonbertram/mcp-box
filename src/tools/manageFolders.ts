import type { ToolDefinition, ToolContext } from '../types.js';

export const manageFoldersTool: ToolDefinition = {
  name: 'box_manage_folders',
  description: 'Create, move, rename, or delete folders by path or ID',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'move', 'rename', 'delete']
      },
      folders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            folderId: { type: 'string' },
            newPath: { type: 'string' },
            newName: { type: 'string' },
            description: { type: 'string' }
          }
        }
      }
    },
    required: ['action', 'folders']
  },
  outputSchema: {
    type: 'object',
    properties: {
      results: { type: 'array', items: { type: 'object' } },
      success: { type: 'boolean' }
    },
    required: ['results', 'success']
  },
  handler: async (args: any, context: ToolContext) => {
    const results: any[] = [];
    const box = context.box;

    for (const f of args.folders ?? []) {
      try {
        switch (args.action) {
          case 'create': {
            if (!f.path) throw new Error('path required');
            const id = await box.ensureFolderPath(f.path, f.description);
            results.push({ action: 'create', path: f.path, success: true, folderId: id });
            break;
          }
          case 'rename': {
            const id = f.folderId ?? (await box.resolveFolderPath(f.path ?? ''));
            if (!id) throw new Error('folder not found');
            if (!f.newName) throw new Error('newName required');
            await box.renameFolder(id, f.newName);
            results.push({ action: 'rename', success: true, folderId: id, newName: f.newName });
            break;
          }
          case 'move': {
            const id = f.folderId ?? (await box.resolveFolderPath(f.path ?? ''));
            if (!id) throw new Error('folder not found');
            if (!f.newPath) throw new Error('newPath required');
            const parentPathParts = f.newPath.split('/').filter(Boolean);
            const newName = parentPathParts.pop();
            const parentPath = parentPathParts.join('/');
            const newParentId = parentPath ? await box.ensureFolderPath(parentPath) : '0';
            await box.moveFolder(id, newParentId);
            if (newName) {
              await box.renameFolder(id, newName);
            }
            results.push({ action: 'move', success: true, folderId: id, newPath: f.newPath });
            break;
          }
          case 'delete': {
            const id = f.folderId ?? (await box.resolveFolderPath(f.path ?? ''));
            if (!id) throw new Error('folder not found');
            await box.deleteFolder(id, true);
            results.push({ action: 'delete', success: true, folderId: id });
            break;
          }
        }
      } catch (err: any) {
        results.push({ action: args.action, path: f.path, folderId: f.folderId, success: false, error: err?.message || String(err) });
      }
    }

    const ok = results.every((r) => r.success);
    return {
      success: ok,
      results,
      structuredContent: { results, success: ok }
    };
  }
};

export default manageFoldersTool;
