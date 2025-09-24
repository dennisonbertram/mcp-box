import type { ToolDefinition, ToolContext } from '../types.js';

export const analyzeDocumentTool: ToolDefinition = {
  name: 'box_analyze_document',
  description: 'Use Box AI to analyze a document (summarize, Q&A, extract, translate)',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      fileId: { type: 'string' },
      paths: { type: 'array', items: { type: 'string' } },
      fileIds: { type: 'array', items: { type: 'string' } },
      analysisType: { type: 'string', enum: ['summarize', 'qa', 'extract', 'extract_structured', 'classify', 'translate'] },
      question: { type: 'string', description: 'Question for Q&A mode' },
      options: {
        type: 'object',
        properties: {
          includeCitations: { type: 'boolean', default: false },
          targetLanguage: { type: 'string', description: 'For translate' },
          dialogueHistory: { type: 'array', items: { type: 'object', properties: { prompt: { type: 'string' }, answer: { type: 'string' } } } },
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
      { required: ['analysisType', 'fileId'] },
      { required: ['analysisType', 'path'] },
      { required: ['analysisType', 'fileIds'] },
      { required: ['analysisType', 'paths'] }
    ]
  },
  outputSchema: {
    type: 'object',
    properties: {
      analysisType: { type: 'string' },
      answer: { type: 'string' },
      citations: { type: 'array', items: { type: 'object' } },
      fields: { type: 'object' },
      targetLanguage: { type: 'string' }
    }
  },
  handler: async (args: any, context: ToolContext) => {
    try {
      let fileId: string | undefined = args.fileId;
      let fileIds: string[] | undefined = args.fileIds;
      if (!fileId && !fileIds && args.path) {
        const f = await context.box.getFileByPath(args.path);
        if (!f) throw new Error(`File not found: ${args.path}`);
        fileId = f.id;
      }
      if (!fileIds && args.paths) {
        const ids: string[] = [];
        for (const p of args.paths) {
          const f = await context.box.getFileByPath(p);
          if (!f) throw new Error(`File not found: ${p}`);
          ids.push(f.id);
        }
        fileIds = ids;
      }
      if (!fileId && (!fileIds || fileIds.length === 0)) throw new Error('fileId(s) is required');

      const type = args.analysisType;
      const primaryId: string | undefined = fileId ?? (fileIds && fileIds[0]);
      switch (type) {
        case 'summarize': {
          const focus = args.options?.summaryFocus ? ` Focus on: ${args.options.summaryFocus}.` : '';
          const prompt = `Summarize the document in detail.${focus}`;
          const res = await context.box.aiTextGen({ prompt, fileId: primaryId as string });
          return { success: true, structuredContent: { analysisType: type, answer: res.answer }, answer: res.answer };
        }
        case 'qa': {
          const prompt = args.question || 'Answer questions about the documents.';
          const ids: string[] = (fileIds && fileIds.length ? fileIds : [primaryId as string]) as string[];
          const mode = ids.length > 1 ? 'multiple_item_qa' : 'single_item_qa';
          const res = await context.box.aiAsk({ prompt, fileIds: ids, mode, includeCitations: !!args.options?.includeCitations, dialogueHistory: args.options?.dialogueHistory });
          return { success: true, structuredContent: { analysisType: type, answer: res.answer, citations: res.citations }, answer: res.answer, citations: res.citations };
        }
        case 'extract': {
          const prompt = args.options?.fields?.length
            ? `Extract the following fields as JSON: ${args.options.fields.map((f: any) => f.key).join(', ')}`
            : 'Extract key facts as JSON.';
          const res = await context.box.aiExtract({ prompt, fileIds: [primaryId as string] });
          return { success: true, structuredContent: { analysisType: type, answer: res.answer }, answer: res.answer };
        }
        case 'extract_structured': {
          const res = await context.box.aiExtractStructured({ fileIds: [primaryId as string], fields: args.options?.fields, metadataTemplate: args.options?.metadataTemplate });
          return { success: true, structuredContent: { analysisType: type, fields: res.fields }, fields: res.fields };
        }
        case 'classify': {
          const prompt = `Classify the document into categories and provide brief rationale.`;
          const res = await context.box.aiTextGen({ prompt, fileId: primaryId as string });
          return { success: true, structuredContent: { analysisType: type, answer: res.answer }, answer: res.answer };
        }
        case 'translate': {
          const lang = args.options?.targetLanguage || 'en';
          const prompt = `Translate the document to ${lang}.`;
          const res = await context.box.aiTextGen({ prompt, fileId: primaryId as string });
          return { success: true, structuredContent: { analysisType: type, answer: res.answer, targetLanguage: lang }, answer: res.answer, targetLanguage: lang };
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
