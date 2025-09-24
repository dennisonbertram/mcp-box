import type { ToolDefinition, ToolContext } from '../types.js';

export const shareContentTool: ToolDefinition = {
  name: 'box_share_content',
  description: 'Create shared links and/or add collaborators to files or folders',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            itemId: { type: 'string' },
            path: { type: 'string' },
            itemType: { type: 'string', enum: ['file', 'folder'] }
          }
        }
      },
      shareMethod: { type: 'string', enum: ['link', 'collaborator', 'both'] },
      linkSettings: {
        type: 'object',
        properties: {
          access: { type: 'string', enum: ['open', 'company', 'collaborators'], default: 'company' },
          password: { type: 'string' },
          expiresIn: { type: 'number' },
          canDownload: { type: 'boolean', default: true }
        }
      },
      collaborators: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['viewer', 'editor', 'co-owner', 'previewer', 'uploader', 'previewer uploader', 'viewer uploader'], default: 'viewer' },
            notify: { type: 'boolean', default: true }
          },
          required: ['email']
        }
      }
    },
    required: ['items', 'shareMethod']
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
    const box = context.box;
    const results: any[] = [];
    for (const item of args.items ?? []) {
      try {
        let itemId: string | undefined = item.itemId;
        if (!itemId && item.path) {
          if (item.itemType === 'folder') {
            const id = await box.resolveFolderPath(item.path);
            if (!id) throw new Error(`Folder not found: ${item.path}`);
            itemId = id;
          } else if (item.itemType === 'file') {
            const f = await box.getFileByPath(item.path);
            if (!f) throw new Error(`File not found: ${item.path}`);
            itemId = f.id;
          } else {
            throw new Error('itemType required for path resolution');
          }
        }
        if (!itemId) throw new Error('itemId or path is required');

        const shareResult: any = { itemType: item.itemType, itemId, path: item.path };
        const method = args.shareMethod;

        if (method === 'link' || method === 'both') {
          const unsharedAt = args.linkSettings?.expiresIn ? new Date(Date.now() + args.linkSettings.expiresIn * 86400000).toISOString() : undefined;
          const link = await box.createSharedLink({
            itemType: item.itemType,
            itemId,
            access: args.linkSettings?.access,
            password: args.linkSettings?.password,
            canDownload: args.linkSettings?.canDownload !== false,
            unsharedAt: unsharedAt ?? null
          });
          shareResult.sharedLink = link?.url;
          shareResult.linkAccess = link?.access;
          shareResult.unsharedAt = link?.unsharedAt;
        }

        if (method === 'collaborator' || method === 'both') {
          const notify = (args.collaborators?.[0]?.notify) ?? true;
          const collabRes = await box.addCollaborators({
            itemType: item.itemType,
            itemId,
            collaborators: (args.collaborators || []).map((c: any) => ({ email: c.email, role: c.role || 'viewer' })),
            notify
          });
          shareResult.collaborators = collabRes.added;
        }

        results.push({ success: true, ...shareResult });
      } catch (err: any) {
        results.push({ success: false, itemType: item.itemType, path: item.path, itemId: item.itemId, error: err?.message || String(err) });
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

export default shareContentTool;
