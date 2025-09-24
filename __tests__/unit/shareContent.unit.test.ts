import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';
import { shareContentTool } from '../../src/tools/shareContent.js';

describe('box_share_content (unit)', () => {
  test('creates shared link and adds collaborator by path', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };

    await saveDocumentsTool.handler({
      documents: [{ content: 'content', path: 'Share/A/a.txt' }],
      options: { createFolders: true }
    }, ctx as any);

    const res = await shareContentTool.handler({
      items: [{ path: 'Share/A/a.txt', itemType: 'file' }],
      shareMethod: 'both',
      linkSettings: { access: 'open', canDownload: true },
      collaborators: [{ email: 'user@example.com', role: 'viewer', notify: true }]
    }, ctx as any);

    expect(res.success).toBe(true);
    const r0 = res.results[0];
    expect(r0.sharedLink).toMatch(/^https:\/\/box\.mock\/shared\/file\//);
    expect(r0.collaborators[0].email).toBe('user@example.com');
  });
});

