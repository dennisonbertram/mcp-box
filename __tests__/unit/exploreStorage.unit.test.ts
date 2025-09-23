import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';
import { exploreStorageTool } from '../../src/tools/exploreStorage.js';

describe('box_explore_storage (unit)', () => {
  test('returns tree with files', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };

    await saveDocumentsTool.handler({
      documents: [
        { content: 'a', path: 'Tree/A/a.txt' },
        { content: 'b', path: 'Tree/A/B/b.txt' }
      ],
      options: { createFolders: true }
    }, ctx as any);

    const res = await exploreStorageTool.handler({ path: 'Tree', options: { depth: 3, includeFiles: true } }, ctx as any);
    expect(res.success).toBe(true);
    expect(res.tree.name).toBe('Tree');
    const names = JSON.stringify(res.tree);
    expect(names).toMatch(/a.txt/);
    expect(names).toMatch(/b.txt/);
  });
});

