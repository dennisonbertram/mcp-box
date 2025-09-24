import { InMemoryBoxClient } from '../../src/box/boxClient.js';
import { saveDocumentsTool } from '../../src/tools/saveDocuments.js';
import { analyzeDocumentTool } from '../../src/tools/analyzeDocument.js';

describe('box_analyze_document (unit)', () => {
  test('summarize returns summary', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };
    await saveDocumentsTool.handler({ documents: [{ content: 'This is a long document about MCP and Box.', path: 'AI/doc.txt' }], options: { createFolders: true } }, ctx as any);
    const res = await analyzeDocumentTool.handler({ path: 'AI/doc.txt', analysisType: 'summarize', options: { summaryFocus: 'key points' } }, ctx as any);
    expect(res.success).toBe(true);
    expect(res.answer).toMatch(/Summary:/);
  });

  test('qa returns answer', async () => {
    const box = new InMemoryBoxClient();
    const ctx = { box, env: {} as any };
    await saveDocumentsTool.handler({ documents: [{ content: 'The capital of France is Paris.', path: 'AI/qa.txt' }], options: { createFolders: true } }, ctx as any);
    const res = await analyzeDocumentTool.handler({ path: 'AI/qa.txt', analysisType: 'qa', question: 'What is the capital of France?' }, ctx as any);
    expect(res.success).toBe(true);
    expect(res.answer).toMatch(/Q:/);
  });
});

