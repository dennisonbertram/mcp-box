import type { ToolDefinition, ToolContext } from '../types.js';

export const analyzeDocumentTool: ToolDefinition = {
  name: 'box_analyze_document',
  description: 'Use Box AI to analyze a document (summarize, Q&A, extract, translate)',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      fileId: { type: 'string' },
      analysisType: { type: 'string', enum: ['summarize', 'qa', 'extract', 'extract_structured', 'classify', 'translate'] },
      question: { type: 'string', description: 'Question for Q&A mode' },
      options: {
        type: 'object',
        properties: {
          includeCitations: { type: 'boolean', default: false },
          targetLanguage: { type: 'string', description: 'For translate' },
          fields: {
            type: 'array',
            items: { type: 'object', properties: { key: { type: 'string' }, description: { type: 'string' } }, required: ['key'] }
          },
          metadataTemplate: { type: 'object', properties: { templateKey: { type: 'string' }, scope: { type: 'string' } } },
          summaryFocus: { type: 'string' }
        }
      }
    },
    oneOf: [
      { required: ['fileId', 'analysisType'] },
      { required: ['path', 'analysisType'] }
    ]
  },
  handler: async (args: any, context: ToolContext) => {
    try {
      let fileId: string | undefined = args.fileId;
      if (!fileId && args.path) {
        const f = await context.box.getFileByPath(args.path);
        if (!f) throw new Error(`File not found: ${args.path}`);
        fileId = f.id;
      }
      if (!fileId) throw new Error('fileId is required');

      const type = args.analysisType;
      switch (type) {
        case 'summarize': {
          const focus = args.options?.summaryFocus ? ` Focus on: ${args.options.summaryFocus}.` : '';
          const prompt = `Summarize the document in detail.${focus}`;
          const res = await context.box.aiTextGen({ prompt, fileId });
          return { success: true, analysisType: type, answer: res.answer, createdAt: res.createdAt };
        }
        case 'qa': {
          const prompt = args.question || 'Answer questions about this document.';
          const res = await context.box.aiAsk({ prompt, fileIds: [fileId], mode: 'single_item_qa', includeCitations: !!args.options?.includeCitations });
          return { success: true, analysisType: type, answer: res.answer, citations: res.citations, createdAt: res.createdAt };
        }
        case 'extract': {
          const prompt = args.options?.fields?.length
            ? `Extract the following fields as JSON: ${args.options.fields.map((f: any) => f.key).join(', ')}`
            : 'Extract key facts as JSON.';
          const res = await context.box.aiExtract({ prompt, fileIds: [fileId] });
          return { success: true, analysisType: type, answer: res.answer, createdAt: res.createdAt };
        }
        case 'extract_structured': {
          const res = await context.box.aiExtractStructured({ fileIds: [fileId], fields: args.options?.fields, metadataTemplate: args.options?.metadataTemplate });
          return { success: true, analysisType: type, fields: res.fields, raw: res.raw };
        }
        case 'classify': {
          const prompt = `Classify the document into categories and provide brief rationale.`;
          const res = await context.box.aiTextGen({ prompt, fileId });
          return { success: true, analysisType: type, answer: res.answer };
        }
        case 'translate': {
          const lang = args.options?.targetLanguage || 'en';
          const prompt = `Translate the document to ${lang}.`;
          const res = await context.box.aiTextGen({ prompt, fileId });
          return { success: true, analysisType: type, answer: res.answer, targetLanguage: lang };
        }
        default:
          return { success: false, error: `Unsupported analysisType: ${type}` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
};

export default analyzeDocumentTool;
