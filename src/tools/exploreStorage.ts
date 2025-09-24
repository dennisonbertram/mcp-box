import type { ToolDefinition, ToolContext } from '../types.js';

function matchesPattern(name: string, pattern?: string) {
  if (!pattern) return true;
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return regex.test(name);
}

function sortItems(entries: any[], sortBy: string) {
  const key = sortBy || 'name';
  const collator = new Intl.Collator('en');
  return [...entries].sort((a, b) => {
    if (key === 'name') return collator.compare(a.name, b.name);
    if (key === 'size') return (a.size || 0) - (b.size || 0);
    if (key === 'date') return new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
    if (key === 'type') return collator.compare(a.type, b.type);
    return 0;
  });
}

async function buildTree(box: ToolContext['box'], folderId: string, path: string, depth: number, opts: any): Promise<any> {
  if (depth >= (opts.depth ?? 2)) return null;
  const raw = await box.listFolderItems(folderId);
  const entries = sortItems(raw as any[], opts.sortBy || 'name');
  const children: any[] = [];
  for (const item of entries) {
    if (!matchesPattern(item.name, opts.pattern)) continue;
    if (item.type === 'folder') {
      const childId = await box.resolveFolderPath(`${path === '/' ? '' : path}/${item.name}`);
      const subtree = await buildTree(box, childId || '0', `${path === '/' ? '' : path}/${item.name}`, depth + 1, opts);
      if (subtree) children.push(subtree);
    } else if (opts.includeFiles) {
      children.push({
        name: item.name,
        path: `${path === '/' ? '' : path}/${item.name}`,
        type: 'file',
        size: opts.includeSizes ? item.size : undefined,
        modified: opts.includeModified ? item.modified : undefined
      });
    }
  }
  return {
    name: path.split('/').filter(Boolean).pop() || '/',
    path,
    type: 'folder',
    modified: opts.includeModified ? undefined : undefined,
    children
  };
}

export const exploreStorageTool: ToolDefinition = {
  name: 'box_explore_storage',
  description: 'Return a tree structure of folders/files starting at a path',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', default: '/' },
      options: {
        type: 'object',
        properties: {
          depth: { type: 'number', default: 2 },
          includeFiles: { type: 'boolean', default: true },
          includeSizes: { type: 'boolean', default: true },
          includeModified: { type: 'boolean', default: true },
          pattern: { type: 'string' },
          sortBy: { type: 'string', enum: ['name', 'date', 'size', 'type'], default: 'name' }
        }
      }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      tree: { type: 'object' }
    },
    required: ['path', 'tree']
  },
  handler: async (args: any, context: ToolContext) => {
    const path = args.path || '/';
    try {
      const folderId = path === '/' ? '0' : await context.box.resolveFolderPath(path);
      if (!folderId) throw new Error(`Path not found: ${path}`);
      const tree = await buildTree(context.box, folderId, path, 0, args.options || {});
      return { success: true, structuredContent: { path, tree }, path, tree };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
};

export default exploreStorageTool;
