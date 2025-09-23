import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';

describe('box_save_documents (unit)', () => {
  test('saves two documents, prevents overwrite by default', async () => {
    const box = new InMemoryBoxClient();
    const context = { box, env: {} as any };

    const first = await saveDocumentsTool.handler(
      {
        documents: [
          { content: 'hello', path: 'Reports/2025/Q3/a.txt' },
          { content: 'world', path: 'Reports/2025/Q3/b.txt' }
        ],
        options: { createFolders: true }
      },
      context as any
    );

    expect(first.success).toBe(true);
    expect(first.saved).toBe(2);

    const second = await saveDocumentsTool.handler(
      {
        documents: [
          { content: 'again', path: 'Reports/2025/Q3/a.txt' }
        ],
        options: { createFolders: true }
      },
      context as any
    );

    expect(second.success).toBe(false);
    expect(second.saved).toBe(0);
    expect(second.results[0].error).toMatch(/exists/i);
  });
});
