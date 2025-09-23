import type { ToolDefinition, ToolContext } from '../types.js';

export const searchContentTool: ToolDefinition = {
  name: 'box_search_content',
  description: 'Search Box for files and folders with optional filters',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      filters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['file', 'folder', 'all'], default: 'all' },
          extensions: { type: 'array', items: { type: 'string' } },
          folders: { type: 'array', items: { type: 'string' } }
        }
      },
      options: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
          includeContent: { type: 'boolean', default: true },
          includeTrashed: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['relevance', 'modified_at'], default: 'relevance' },
          direction: { type: 'string', enum: ['DESC', 'ASC'], default: 'DESC' }
        }
      }
    },
    required: ['query']
  },
  handler: async (args: any, context: ToolContext) => {
    try {
      const res = await context.box.searchContent({
        query: args.query,
        type: args.filters?.type || 'all',
        extensions: args.filters?.extensions,
        folders: args.filters?.folders,
        includeContent: args.options?.includeContent !== false,
        includeTrashed: !!args.options?.includeTrashed,
        limit: args.options?.limit || 20,
        sortBy: args.options?.sortBy || 'relevance',
        direction: args.options?.direction || 'DESC'
      });
      return { success: true, totalResults: res.totalCount, results: res.entries };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
};

export default searchContentTool;
