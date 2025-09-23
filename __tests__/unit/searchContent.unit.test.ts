import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';
import { searchContentTool } from '../../src/tools/searchContent.js';

describe('box_search_content (unit)', () => {
  test('search by query and extension filter', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };

    await saveDocumentsTool.handler({
      documents: [
        { content: 'alpha content', path: 'Search/X/alpha.txt' },
        { content: 'beta content', path: 'Search/X/beta.pdf' }
      ],
      options: { createFolders: true }
    }, ctx as any);

    const res = await searchContentTool.handler({ query: 'alpha', filters: { type: 'file', extensions: ['txt'] } }, ctx as any);
    expect(res.success).toBe(true);
    expect(res.results.length).toBe(1);
    expect(res.results[0].name).toBe('alpha.txt');
  });
});

