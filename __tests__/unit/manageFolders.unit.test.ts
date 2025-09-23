import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { manageFoldersTool } from '../../src/tools/manageFolders.js';

describe('box_manage_folders (unit)', () => {
  test('create -> rename -> move -> delete', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };

    // create
    let res = await manageFoldersTool.handler({ action: 'create', folders: [{ path: 'A/B/C' }] }, ctx as any);
    expect(res.success).toBe(true);
    const idC = res.results[0].folderId;
    expect(idC).toBeTruthy();

    // rename C to D
    res = await manageFoldersTool.handler({ action: 'rename', folders: [{ folderId: idC, newName: 'D' }] }, ctx as any);
    expect(res.success).toBe(true);

    // move D to /X/Y/D
    res = await manageFoldersTool.handler({ action: 'move', folders: [{ folderId: idC, newPath: 'X/Y/D' }] }, ctx as any);
    expect(res.success).toBe(true);

    // delete Y
    const idY = await box.resolveFolderPath('X/Y');
    expect(idY).toBeTruthy();
    res = await manageFoldersTool.handler({ action: 'delete', folders: [{ folderId: idY }] }, ctx as any);
    expect(res.success).toBe(true);

    const stillThere = await box.resolveFolderPath('X/Y');
    expect(stillThere).toBeNull();
  });
});

