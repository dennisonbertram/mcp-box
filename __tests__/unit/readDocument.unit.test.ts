import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';
import { readDocumentTool } from '../../src/tools/readDocument.js';

describe('box_read_document (unit)', () => {
  test('reads back text content by path', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };
    await saveDocumentsTool.handler(
      {
        documents: [{ content: 'hello world', path: 'Readme/hello.txt' }],
        options: { createFolders: true }
      },
      ctx as any
    );

    const res = await readDocumentTool.handler({ path: 'Readme/hello.txt' }, ctx as any);
    expect(res.success).toBe(true);
    expect(res.content).toBe('hello world');
  });
});
