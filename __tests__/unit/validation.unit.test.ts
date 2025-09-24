import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { McpServer } from '../../src/server.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';

describe('input validation', () => {
  test('invalid args produce isError result', async () => {
    const server = new McpServer({ tools: [saveDocumentsTool], context: { box: new InMemoryBoxClient(), env: {} as any } });
    const res = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'box_save_documents', arguments: {} } } as any);
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toMatch(/Invalid arguments/);
  });
});

