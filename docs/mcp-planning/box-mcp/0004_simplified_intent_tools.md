# Task 0004: Simplified Intent-Based Tools

## Overview

This document defines the simplified, intent-based tool set for the Box MCP server. These 8 tools focus on high-level user intentions rather than individual API operations, making the server more intuitive for LLMs to use.

## Core Intent-Based Tools (8 tools)

### 1. **box_save_documents**
Save multiple documents to Box with specified folder paths

### 2. **box_retrieve_documents**
Retrieve documents from Box and optionally save locally

### 3. **box_read_document**
Read document content without local storage

### 4. **box_manage_folders**
Create, organize, and manage folder structures

### 5. **box_explore_storage**
Get directory listings and navigate Box storage

### 6. **box_share_content**
Share files/folders with links or collaborators

### 7. **box_analyze_document**
Use Box AI to analyze and understand documents

### 8. **box_search_content**
Search across Box storage with natural language

## Detailed Tool Specifications

### 1. Save Documents Tool
```typescript
export const saveDocumentsTool: Tool = {
  name: 'box_save_documents',
  description: 'Save multiple documents to Box storage with automatic folder creation',
  inputSchema: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        description: 'Array of documents to save',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Document content (text or base64)'
            },
            contentUrl: {
              type: 'string',
              description: 'URL to fetch content from'
            },
            path: {
              type: 'string',
              description: 'Full path including filename (e.g., "Projects/2024/report.pdf")'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata',
              properties: {
                description: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                classification: {
                  type: 'string',
                  enum: ['Public', 'Internal', 'Confidential', 'Restricted']
                }
              }
            }
          },
          required: ['path'],
          oneOf: [
            { required: ['content'] },
            { required: ['contentUrl'] }
          ]
        }
      },
      options: {
        type: 'object',
        properties: {
          overwrite: {
            type: 'boolean',
            description: 'Overwrite existing files',
            default: false
          },
          createFolders: {
            type: 'boolean',
            description: 'Auto-create missing folders',
            default: true
          },
          shareSettings: {
            type: 'object',
            description: 'Apply sharing settings to all saved files',
            properties: {
              createLink: { type: 'boolean' },
              linkAccess: {
                type: 'string',
                enum: ['open', 'company', 'collaborators']
              }
            }
          }
        }
      }
    },
    required: ['documents']
  },

  async handler(args, context) {
    const results = [];
    const boxClient = await BoxClient.getInstance(context);

    for (const doc of args.documents) {
      try {
        // Parse path to separate folders and filename
        const pathParts = doc.path.split('/');
        const fileName = pathParts.pop();
        const folderPath = pathParts.join('/');

        // Create folder structure if needed
        let parentId = '0';
        if (folderPath && args.options?.createFolders) {
          parentId = await ensureFolderPath(boxClient, folderPath);
        }

        // Get content
        const content = await getDocumentContent(doc);

        // Check if file exists
        if (!args.options?.overwrite) {
          const existing = await checkFileExists(boxClient, parentId, fileName);
          if (existing) {
            results.push({
              path: doc.path,
              success: false,
              error: 'File already exists'
            });
            continue;
          }
        }

        // Upload file
        const file = await boxClient.files.upload({
          file: content,
          filename: fileName,
          parent_id: parentId
        });

        // Apply metadata if provided
        if (doc.metadata) {
          await applyMetadata(boxClient, file.id, doc.metadata);
        }

        // Apply sharing if requested
        let sharedLink = null;
        if (args.options?.shareSettings?.createLink) {
          sharedLink = await createSharedLink(
            boxClient,
            file.id,
            args.options.shareSettings.linkAccess
          );
        }

        results.push({
          path: doc.path,
          success: true,
          fileId: file.id,
          size: file.size,
          sharedLink: sharedLink?.url
        });

      } catch (error) {
        results.push({
          path: doc.path,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: results.every(r => r.success),
      saved: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
};
```

### 2. Retrieve Documents Tool
```typescript
export const retrieveDocumentsTool: Tool = {
  name: 'box_retrieve_documents',
  description: 'Retrieve documents from Box and optionally save locally',
  inputSchema: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        description: 'Documents to retrieve',
        items: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'Box file ID'
            },
            path: {
              type: 'string',
              description: 'Box file path (alternative to ID)'
            },
            localPath: {
              type: 'string',
              description: 'Local path to save file (optional)'
            },
            version: {
              type: 'string',
              description: 'Specific version to retrieve'
            }
          },
          oneOf: [
            { required: ['fileId'] },
            { required: ['path'] }
          ]
        }
      },
      options: {
        type: 'object',
        properties: {
          saveLocally: {
            type: 'boolean',
            description: 'Save files to local filesystem',
            default: false
          },
          includeMetadata: {
            type: 'boolean',
            description: 'Include file metadata',
            default: true
          },
          asText: {
            type: 'boolean',
            description: 'Return content as text instead of base64',
            default: false
          }
        }
      }
    },
    required: ['documents']
  },

  async handler(args, context) {
    const results = [];
    const boxClient = await BoxClient.getInstance(context);

    for (const doc of args.documents) {
      try {
        // Get file ID if path provided
        let fileId = doc.fileId;
        if (!fileId && doc.path) {
          fileId = await resolvePathToId(boxClient, doc.path);
        }

        // Get file info
        const fileInfo = await boxClient.files.get(fileId);

        // Download content
        const content = await downloadFile(
          boxClient,
          fileId,
          doc.version
        );

        // Save locally if requested
        if (args.options?.saveLocally && doc.localPath) {
          await saveToLocalPath(doc.localPath, content);
        }

        // Format content for response
        const formattedContent = args.options?.asText
          ? content.toString('utf8')
          : content.toString('base64');

        results.push({
          success: true,
          fileId: fileId,
          name: fileInfo.name,
          size: fileInfo.size,
          content: args.options?.saveLocally ? undefined : formattedContent,
          localPath: doc.localPath,
          metadata: args.options?.includeMetadata ? {
            created: fileInfo.created_at,
            modified: fileInfo.modified_at,
            owner: fileInfo.owned_by?.name,
            description: fileInfo.description,
            tags: fileInfo.tags
          } : undefined
        });

      } catch (error) {
        results.push({
          success: false,
          fileId: doc.fileId,
          path: doc.path,
          error: error.message
        });
      }
    }

    return {
      success: results.every(r => r.success),
      retrieved: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
};
```

### 3. Read Document Tool
```typescript
export const readDocumentTool: Tool = {
  name: 'box_read_document',
  description: 'Read document content without saving locally - perfect for AI analysis',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      path: {
        type: 'string',
        description: 'Box file path (alternative to ID)'
      },
      options: {
        type: 'object',
        properties: {
          extractText: {
            type: 'boolean',
            description: 'Extract text from documents (PDF, DOCX, etc.)',
            default: true
          },
          includeMetadata: {
            type: 'boolean',
            description: 'Include document metadata',
            default: true
          },
          includeComments: {
            type: 'boolean',
            description: 'Include document comments',
            default: false
          },
          maxLength: {
            type: 'number',
            description: 'Maximum content length to return',
            default: 100000
          }
        }
      }
    },
    oneOf: [
      { required: ['fileId'] },
      { required: ['path'] }
    ]
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Resolve file ID
      let fileId = args.fileId;
      if (!fileId && args.path) {
        fileId = await resolvePathToId(boxClient, args.path);
      }

      // Get file info
      const fileInfo = await boxClient.files.get(fileId, {
        fields: 'name,size,extension,description,tags,created_at,modified_at,owned_by,shared_link'
      });

      // Get content based on file type
      let content;
      if (args.options?.extractText && isTextExtractable(fileInfo.extension)) {
        // Use Box's text extraction service
        content = await boxClient.files.getTextRepresentation(fileId);
      } else {
        // Get raw content
        const buffer = await downloadFile(boxClient, fileId);
        content = buffer.toString('utf8');
      }

      // Truncate if needed
      if (args.options?.maxLength && content.length > args.options.maxLength) {
        content = content.substring(0, args.options.maxLength) + '...[truncated]';
      }

      // Get comments if requested
      let comments = [];
      if (args.options?.includeComments) {
        const fileComments = await boxClient.comments.get(fileId);
        comments = fileComments.entries.map(c => ({
          author: c.created_by.name,
          message: c.message,
          created: c.created_at
        }));
      }

      return {
        success: true,
        file: {
          id: fileId,
          name: fileInfo.name,
          extension: fileInfo.extension,
          size: fileInfo.size
        },
        content: content,
        metadata: args.options?.includeMetadata ? {
          description: fileInfo.description,
          tags: fileInfo.tags,
          created: fileInfo.created_at,
          modified: fileInfo.modified_at,
          owner: fileInfo.owned_by?.name,
          sharedLink: fileInfo.shared_link?.url
        } : undefined,
        comments: comments.length > 0 ? comments : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

### 4. Manage Folders Tool
```typescript
export const manageFoldersTool: Tool = {
  name: 'box_manage_folders',
  description: 'Create, organize, and manage folder structures',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'move', 'rename', 'delete', 'organize'],
        description: 'Folder management action'
      },
      folders: {
        type: 'array',
        description: 'Folders to manage',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Folder path'
            },
            folderId: {
              type: 'string',
              description: 'Folder ID (for existing folders)'
            },
            newPath: {
              type: 'string',
              description: 'New path (for move/rename)'
            },
            newName: {
              type: 'string',
              description: 'New name (for rename)'
            },
            description: {
              type: 'string',
              description: 'Folder description'
            }
          }
        }
      },
      organizationRules: {
        type: 'object',
        description: 'Rules for organize action',
        properties: {
          byDate: {
            type: 'boolean',
            description: 'Organize by date (Year/Month)'
          },
          byType: {
            type: 'boolean',
            description: 'Organize by file type'
          },
          byOwner: {
            type: 'boolean',
            description: 'Organize by owner'
          },
          customPattern: {
            type: 'string',
            description: 'Custom organization pattern'
          }
        }
      }
    },
    required: ['action', 'folders']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);
    const results = [];

    switch (args.action) {
      case 'create':
        for (const folder of args.folders) {
          try {
            const folderId = await ensureFolderPath(
              boxClient,
              folder.path,
              folder.description
            );
            results.push({
              action: 'create',
              path: folder.path,
              success: true,
              folderId: folderId
            });
          } catch (error) {
            results.push({
              action: 'create',
              path: folder.path,
              success: false,
              error: error.message
            });
          }
        }
        break;

      case 'move':
        for (const folder of args.folders) {
          try {
            const sourceFolderId = folder.folderId ||
              await resolvePathToId(boxClient, folder.path);
            const targetParentId = await ensureFolderPath(
              boxClient,
              getParentPath(folder.newPath)
            );

            await boxClient.folders.move(sourceFolderId, targetParentId);

            results.push({
              action: 'move',
              from: folder.path,
              to: folder.newPath,
              success: true
            });
          } catch (error) {
            results.push({
              action: 'move',
              from: folder.path,
              success: false,
              error: error.message
            });
          }
        }
        break;

      case 'rename':
        for (const folder of args.folders) {
          try {
            const folderId = folder.folderId ||
              await resolvePathToId(boxClient, folder.path);

            await boxClient.folders.update(folderId, {
              name: folder.newName
            });

            results.push({
              action: 'rename',
              path: folder.path,
              newName: folder.newName,
              success: true
            });
          } catch (error) {
            results.push({
              action: 'rename',
              path: folder.path,
              success: false,
              error: error.message
            });
          }
        }
        break;

      case 'delete':
        for (const folder of args.folders) {
          try {
            const folderId = folder.folderId ||
              await resolvePathToId(boxClient, folder.path);

            await boxClient.folders.delete(folderId, { recursive: true });

            results.push({
              action: 'delete',
              path: folder.path,
              success: true
            });
          } catch (error) {
            results.push({
              action: 'delete',
              path: folder.path,
              success: false,
              error: error.message
            });
          }
        }
        break;

      case 'organize':
        // Implement intelligent organization
        const organizeResults = await organizeContent(
          boxClient,
          args.folders[0].path || '0',
          args.organizationRules
        );
        results.push(...organizeResults);
        break;
    }

    return {
      success: results.every(r => r.success),
      completed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
};
```

### 5. Explore Storage Tool
```typescript
export const exploreStorageTool: Tool = {
  name: 'box_explore_storage',
  description: 'Get directory listings and navigate Box storage structure',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Starting path (empty for root)',
        default: '/'
      },
      options: {
        type: 'object',
        properties: {
          depth: {
            type: 'number',
            description: 'How many levels deep to explore',
            default: 2
          },
          includeFiles: {
            type: 'boolean',
            description: 'Include files in listing',
            default: true
          },
          includeSizes: {
            type: 'boolean',
            description: 'Include size information',
            default: true
          },
          includeModified: {
            type: 'boolean',
            description: 'Include modification dates',
            default: true
          },
          pattern: {
            type: 'string',
            description: 'Filter pattern (e.g., "*.pdf")'
          },
          sortBy: {
            type: 'string',
            enum: ['name', 'date', 'size', 'type'],
            default: 'name'
          }
        }
      }
    }
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Resolve starting folder
      const startFolderId = args.path === '/' ? '0' :
        await resolvePathToId(boxClient, args.path);

      // Build tree structure
      const tree = await buildStorageTree(
        boxClient,
        startFolderId,
        args.path || '/',
        0,
        args.options
      );

      // Calculate statistics
      const stats = calculateStorageStats(tree);

      return {
        success: true,
        path: args.path || '/',
        tree: tree,
        statistics: {
          totalFolders: stats.folders,
          totalFiles: stats.files,
          totalSize: formatBytes(stats.size),
          depth: args.options?.depth || 2
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

async function buildStorageTree(
  client: any,
  folderId: string,
  path: string,
  currentDepth: number,
  options: any
): Promise<any> {
  if (currentDepth >= (options?.depth || 2)) {
    return null;
  }

  const folder = await client.folders.get(folderId);
  const items = await client.folders.getItems(folderId, {
    fields: 'name,size,modified_at,type'
  });

  const tree: any = {
    name: folder.name,
    path: path,
    type: 'folder',
    modified: options?.includeModified ? folder.modified_at : undefined,
    children: []
  };

  // Sort items
  const sortedItems = sortItems(items.entries, options?.sortBy);

  for (const item of sortedItems) {
    // Apply pattern filter
    if (options?.pattern && !matchesPattern(item.name, options.pattern)) {
      continue;
    }

    if (item.type === 'folder') {
      const subtree = await buildStorageTree(
        client,
        item.id,
        `${path}/${item.name}`,
        currentDepth + 1,
        options
      );
      if (subtree) {
        tree.children.push(subtree);
      }
    } else if (options?.includeFiles && item.type === 'file') {
      tree.children.push({
        name: item.name,
        path: `${path}/${item.name}`,
        type: 'file',
        size: options?.includeSizes ? formatBytes(item.size) : undefined,
        modified: options?.includeModified ? item.modified_at : undefined
      });
    }
  }

  return tree;
}
```

### 6. Share Content Tool
```typescript
export const shareContentTool: Tool = {
  name: 'box_share_content',
  description: 'Share files or folders with links or collaborators',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Items to share',
        items: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description: 'File or folder ID'
            },
            path: {
              type: 'string',
              description: 'File or folder path'
            },
            itemType: {
              type: 'string',
              enum: ['file', 'folder'],
              description: 'Type of item'
            }
          }
        }
      },
      shareMethod: {
        type: 'string',
        enum: ['link', 'collaborator', 'both'],
        description: 'How to share the content'
      },
      linkSettings: {
        type: 'object',
        properties: {
          access: {
            type: 'string',
            enum: ['open', 'company', 'collaborators'],
            default: 'company'
          },
          password: {
            type: 'string',
            description: 'Password protection'
          },
          expiresIn: {
            type: 'number',
            description: 'Days until expiration'
          },
          canDownload: {
            type: 'boolean',
            default: true
          }
        }
      },
      collaborators: {
        type: 'array',
        description: 'People to share with',
        items: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email'
            },
            role: {
              type: 'string',
              enum: ['viewer', 'editor', 'co-owner'],
              default: 'viewer'
            },
            notify: {
              type: 'boolean',
              default: true,
              description: 'Send notification email'
            },
            message: {
              type: 'string',
              description: 'Personal message'
            }
          },
          required: ['email']
        }
      }
    },
    required: ['items', 'shareMethod']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);
    const results = [];

    for (const item of args.items) {
      try {
        // Resolve item ID
        let itemId = item.itemId;
        if (!itemId && item.path) {
          itemId = await resolvePathToId(boxClient, item.path, item.itemType);
        }

        const shareResult: any = {
          itemId: itemId,
          path: item.path,
          type: item.itemType
        };

        // Create shared link
        if (args.shareMethod === 'link' || args.shareMethod === 'both') {
          const sharedLink = await createAdvancedSharedLink(
            boxClient,
            itemId,
            item.itemType,
            args.linkSettings
          );
          shareResult.sharedLink = sharedLink.url;
          shareResult.linkAccess = sharedLink.access;
        }

        // Add collaborators
        if (args.shareMethod === 'collaborator' || args.shareMethod === 'both') {
          const collaborations = [];
          for (const collab of args.collaborators || []) {
            const collaboration = await addCollaboration(
              boxClient,
              itemId,
              item.itemType,
              collab
            );
            collaborations.push({
              email: collab.email,
              role: collab.role,
              id: collaboration.id
            });
          }
          shareResult.collaborators = collaborations;
        }

        results.push({
          ...shareResult,
          success: true
        });

      } catch (error) {
        results.push({
          itemId: item.itemId,
          path: item.path,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: results.every(r => r.success),
      shared: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
};
```

### 7. Analyze Document Tool (Box AI)
```typescript
export const analyzeDocumentTool: Tool = {
  name: 'box_analyze_document',
  description: 'Use Box AI to analyze and understand documents',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      path: {
        type: 'string',
        description: 'Box file path'
      },
      analysisType: {
        type: 'string',
        enum: ['summarize', 'extract', 'qa', 'classify', 'translate'],
        description: 'Type of analysis to perform'
      },
      options: {
        type: 'object',
        properties: {
          // Summarization options
          summaryLength: {
            type: 'string',
            enum: ['brief', 'detailed', 'comprehensive'],
            default: 'detailed'
          },
          summaryFocus: {
            type: 'string',
            description: 'Specific aspect to focus on'
          },

          // Extraction options
          extractFields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific fields to extract (e.g., ["dates", "names", "amounts"])'
          },

          // Q&A options
          questions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Questions to ask about the document'
          },

          // Classification options
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Categories to classify into'
          },

          // Translation options
          targetLanguage: {
            type: 'string',
            description: 'Target language for translation'
          }
        }
      }
    },
    oneOf: [
      { required: ['fileId', 'analysisType'] },
      { required: ['path', 'analysisType'] }
    ]
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Resolve file ID
      let fileId = args.fileId;
      if (!fileId && args.path) {
        fileId = await resolvePathToId(boxClient, args.path);
      }

      // Get file info
      const fileInfo = await boxClient.files.get(fileId);

      // Perform Box AI analysis
      let analysis;
      switch (args.analysisType) {
        case 'summarize':
          analysis = await boxClient.ai.summarize({
            fileId: fileId,
            length: args.options?.summaryLength,
            focus: args.options?.summaryFocus
          });
          break;

        case 'extract':
          analysis = await boxClient.ai.extractInformation({
            fileId: fileId,
            fields: args.options?.extractFields || [
              'key_dates',
              'people',
              'organizations',
              'locations',
              'amounts',
              'key_terms'
            ]
          });
          break;

        case 'qa':
          const answers = [];
          for (const question of args.options?.questions || []) {
            const answer = await boxClient.ai.askQuestion({
              fileId: fileId,
              question: question
            });
            answers.push({
              question: question,
              answer: answer.response,
              confidence: answer.confidence
            });
          }
          analysis = { answers };
          break;

        case 'classify':
          analysis = await boxClient.ai.classify({
            fileId: fileId,
            categories: args.options?.categories || [
              'Contract',
              'Invoice',
              'Report',
              'Presentation',
              'Legal',
              'Financial',
              'Technical',
              'Marketing'
            ]
          });
          break;

        case 'translate':
          analysis = await boxClient.ai.translate({
            fileId: fileId,
            targetLanguage: args.options?.targetLanguage || 'en'
          });
          break;
      }

      return {
        success: true,
        file: {
          id: fileId,
          name: fileInfo.name,
          type: fileInfo.extension
        },
        analysisType: args.analysisType,
        results: analysis,
        metadata: {
          analyzed_at: new Date().toISOString(),
          file_size: fileInfo.size,
          file_modified: fileInfo.modified_at
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        note: 'Box AI features may require specific plan/permissions'
      };
    }
  }
};
```

### 8. Search Content Tool
```typescript
export const searchContentTool: Tool = {
  name: 'box_search_content',
  description: 'Search across Box storage with natural language queries',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query'
      },
      filters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['file', 'folder', 'all'],
            default: 'all'
          },
          extensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'File extensions to search (e.g., ["pdf", "docx"])'
          },
          folders: {
            type: 'array',
            items: { type: 'string' },
            description: 'Folder paths to search within'
          },
          dateRange: {
            type: 'object',
            properties: {
              from: { type: 'string', format: 'date' },
              to: { type: 'string', format: 'date' }
            }
          },
          sizeRange: {
            type: 'object',
            properties: {
              min: { type: 'number', description: 'Minimum size in bytes' },
              max: { type: 'number', description: 'Maximum size in bytes' }
            }
          },
          owners: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by owner emails'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags'
          }
        }
      },
      options: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum results to return',
            default: 20
          },
          includeContent: {
            type: 'boolean',
            description: 'Search within file content',
            default: true
          },
          includeTrashed: {
            type: 'boolean',
            description: 'Include items in trash',
            default: false
          },
          sortBy: {
            type: 'string',
            enum: ['relevance', 'date', 'name', 'size'],
            default: 'relevance'
          }
        }
      }
    },
    required: ['query']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Build search parameters
      const searchParams: any = {
        query: args.query,
        type: args.filters?.type || 'file,folder',
        limit: args.options?.limit || 20,
        sort: mapSortOption(args.options?.sortBy),
        trash_content: args.options?.includeTrashed ? 'trashed_only' : 'non_trashed_only'
      };

      // Add content search
      if (args.options?.includeContent) {
        searchParams.content_types = 'name,description,file_content,comments,tags';
      }

      // Add filters
      if (args.filters?.extensions) {
        searchParams.file_extensions = args.filters.extensions.join(',');
      }

      if (args.filters?.folders) {
        const folderIds = await Promise.all(
          args.filters.folders.map(path => resolvePathToId(boxClient, path))
        );
        searchParams.ancestor_folder_ids = folderIds.join(',');
      }

      if (args.filters?.dateRange) {
        searchParams.created_at_range =
          `${args.filters.dateRange.from},${args.filters.dateRange.to}`;
      }

      if (args.filters?.sizeRange) {
        searchParams.size_range =
          `${args.filters.sizeRange.min},${args.filters.sizeRange.max}`;
      }

      if (args.filters?.owners) {
        searchParams.owner_user_ids = await Promise.all(
          args.filters.owners.map(email => getUserIdByEmail(boxClient, email))
        ).then(ids => ids.join(','));
      }

      // Perform search
      const searchResults = await boxClient.search.query(searchParams);

      // Format results
      const formattedResults = searchResults.entries.map(item => ({
        id: item.id,
        type: item.type,
        name: item.name,
        path: item.path_collection?.entries.map(e => e.name).join('/'),
        size: item.size ? formatBytes(item.size) : undefined,
        modified: item.modified_at,
        owner: item.owned_by?.name,
        description: item.description,
        tags: item.tags,
        matchedContent: item.highlight?.content,
        score: item.score
      }));

      return {
        success: true,
        query: args.query,
        totalResults: searchResults.total_count,
        returned: formattedResults.length,
        results: formattedResults
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

## Helper Functions

### Common Utilities
```typescript
// Path resolution
async function resolvePathToId(
  client: any,
  path: string,
  type: 'file' | 'folder' = 'folder'
): Promise<string> {
  const parts = path.split('/').filter(p => p);
  let currentId = '0';

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const items = await client.folders.getItems(currentId);

    const item = items.entries.find(e =>
      e.name === parts[i] &&
      (isLast ? e.type === type : e.type === 'folder')
    );

    if (!item) {
      throw new Error(`Path not found: ${path}`);
    }

    currentId = item.id;
  }

  return currentId;
}

// Folder creation
async function ensureFolderPath(
  client: any,
  path: string,
  description?: string
): Promise<string> {
  const parts = path.split('/').filter(p => p);
  let currentId = '0';

  for (const part of parts) {
    try {
      const folder = await client.folders.create({
        name: part,
        parent: { id: currentId },
        description: description
      });
      currentId = folder.id;
    } catch (error) {
      if (error.statusCode === 409) {
        // Folder exists
        const items = await client.folders.getItems(currentId);
        const existing = items.entries.find(e =>
          e.type === 'folder' && e.name === part
        );
        currentId = existing.id;
      } else {
        throw error;
      }
    }
  }

  return currentId;
}

// Content fetching
async function getDocumentContent(doc: any): Promise<Buffer> {
  if (doc.content) {
    if (doc.content.includes('base64,')) {
      const base64Data = doc.content.split('base64,')[1];
      return Buffer.from(base64Data, 'base64');
    }
    return Buffer.from(doc.content, 'utf8');
  } else if (doc.contentUrl) {
    const response = await fetch(doc.contentUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new Error('No content provided');
}

// File type checking
function isTextExtractable(extension: string): boolean {
  const extractable = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'];
  return extractable.includes(extension.toLowerCase());
}

// Pattern matching
function matchesPattern(name: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`, 'i').test(name);
}

// Formatting
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
```

## Advanced Mode

The full 45+ tool set remains available in advanced mode, accessible via:

```typescript
export const advancedModeTool: Tool = {
  name: 'box_advanced_mode',
  description: 'Access the complete set of 45+ granular Box API tools',
  inputSchema: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: 'Specific Box API tool name'
      },
      parameters: {
        type: 'object',
        description: 'Tool-specific parameters'
      }
    },
    required: ['tool', 'parameters']
  },

  async handler(args, context) {
    // Route to specific advanced tool
    const advancedTool = advancedTools[args.tool];
    if (!advancedTool) {
      return {
        success: false,
        error: `Unknown tool: ${args.tool}`,
        availableTools: Object.keys(advancedTools)
      };
    }

    return advancedTool.handler(args.parameters, context);
  }
};
```

## Benefits of Simplified Approach

1. **Intent-Focused**: Tools match user intentions rather than API operations
2. **Batch Operations**: Handle multiple items in single calls
3. **Smart Defaults**: Sensible defaults reduce parameter complexity
4. **Path-Based**: Work with familiar file paths instead of IDs
5. **Error Recovery**: Automatic retry and fallback logic
6. **AI Integration**: Built-in Box AI capabilities
7. **Natural Language**: Search and organize with natural language

## Testing the Simplified Tools

```bash
# Save multiple documents
echo '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"box_save_documents","arguments":{"documents":[{"content":"Report content","path":"Reports/2024/Q1/summary.txt"},{"contentUrl":"https://example.com/data.csv","path":"Data/2024/metrics.csv"}]}}}' | node dist/index.js

# Read document for AI analysis
echo '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"box_read_document","arguments":{"path":"Reports/2024/Q1/summary.txt","options":{"extractText":true,"includeMetadata":true}}}}' | node dist/index.js

# Explore storage
echo '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"box_explore_storage","arguments":{"path":"/","options":{"depth":3,"includeFiles":true}}}}' | node dist/index.js

# Search content
echo '{"jsonrpc":"2.0","method":"tools/call","id":4,"params":{"name":"box_search_content","arguments":{"query":"quarterly reports 2024","filters":{"type":"file","extensions":["pdf","docx"]}}}}' | node dist/index.js
```

## Migration Path

Users can gradually transition from simple to advanced tools:

1. **Start Simple**: Use the 8 intent-based tools
2. **Learn Patterns**: Understand common workflows
3. **Add Complexity**: Use advanced options when needed
4. **Go Advanced**: Access full tool set for specific needs

This approach provides an intuitive interface for common tasks while preserving the full power of Box API when needed.