# Task 0002: File Operations Tools

## Overview

This task implements comprehensive file operation tools for the Box MCP server, enabling LLMs to upload, download, manage, and manipulate files in Box cloud storage without local persistence.

## Dependencies

- Task 0001: Authentication System & Server Foundation (must be complete)

## Deliverables

### File Operation Tools (12 tools)

1. **box_upload_file** - Upload file to Box
2. **box_download_file** - Download file from Box
3. **box_get_file_info** - Get file metadata
4. **box_update_file** - Update file content
5. **box_delete_file** - Delete file
6. **box_copy_file** - Copy file
7. **box_move_file** - Move file
8. **box_rename_file** - Rename file
9. **box_get_file_versions** - List file versions
10. **box_promote_version** - Promote file version
11. **box_upload_large_file** - Chunked upload for large files
12. **box_preflight_check** - Pre-upload validation

## Implementation Details

### File Structure
```
src/
├── tools/
│   ├── index.ts              # Tool registration
│   └── files/
│       ├── upload.ts         # Upload operations
│       ├── download.ts       # Download operations
│       ├── management.ts     # CRUD operations
│       ├── versions.ts       # Version management
│       └── chunked.ts        # Large file handling
├── services/
│   └── box-client.ts         # Box SDK wrapper
└── utils/
    ├── stream.ts             # Stream utilities
    └── validation.ts         # Input validation
```

### Tool Implementations

#### 1. Upload File Tool (`src/tools/files/upload.ts`)
```typescript
import { Tool } from '@modelcontextprotocol/sdk';
import { BoxClient } from '../../services/box-client';

export const uploadFileTool: Tool = {
  name: 'box_upload_file',
  description: 'Upload a file to Box cloud storage',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Base64 encoded file content or text content'
      },
      contentUrl: {
        type: 'string',
        description: 'URL to fetch file content from'
      },
      fileName: {
        type: 'string',
        description: 'Name for the uploaded file'
      },
      parentId: {
        type: 'string',
        description: 'Parent folder ID (0 for root)',
        default: '0'
      },
      contentType: {
        type: 'string',
        description: 'MIME type of the file'
      },
      description: {
        type: 'string',
        description: 'File description'
      }
    },
    required: ['fileName'],
    oneOf: [
      { required: ['content'] },
      { required: ['contentUrl'] }
    ]
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Get content
      let fileContent: Buffer;
      if (args.content) {
        // Handle base64 or text content
        if (args.content.includes('base64,')) {
          const base64Data = args.content.split('base64,')[1];
          fileContent = Buffer.from(base64Data, 'base64');
        } else {
          fileContent = Buffer.from(args.content, 'utf8');
        }
      } else if (args.contentUrl) {
        // Fetch content from URL
        fileContent = await fetchContentFromUrl(args.contentUrl);
      }

      // Upload to Box
      const uploadedFile = await boxClient.files.upload({
        file: fileContent,
        filename: args.fileName,
        parent_id: args.parentId,
        content_created_at: new Date().toISOString(),
        content_modified_at: new Date().toISOString()
      });

      return {
        success: true,
        file: {
          id: uploadedFile.id,
          name: uploadedFile.name,
          size: uploadedFile.size,
          url: uploadedFile.shared_link?.url,
          created_at: uploadedFile.created_at
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
```

#### 2. Download File Tool (`src/tools/files/download.ts`)
```typescript
export const downloadFileTool: Tool = {
  name: 'box_download_file',
  description: 'Download a file from Box (returns base64 content)',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      version: {
        type: 'string',
        description: 'Specific version ID (optional)'
      },
      asText: {
        type: 'boolean',
        description: 'Return as text instead of base64',
        default: false
      }
    },
    required: ['fileId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Get file stream
      const fileStream = await boxClient.files.getReadStream(
        args.fileId,
        { version: args.version }
      );

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      // Get file info for metadata
      const fileInfo = await boxClient.files.get(args.fileId);

      // Return content
      const content = args.asText
        ? fileBuffer.toString('utf8')
        : fileBuffer.toString('base64');

      return {
        success: true,
        file: {
          id: fileInfo.id,
          name: fileInfo.name,
          size: fileInfo.size,
          content: content,
          contentType: fileInfo.extension,
          modified_at: fileInfo.modified_at
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
```

#### 3. Large File Upload Tool (`src/tools/files/chunked.ts`)
```typescript
export const uploadLargeFileTool: Tool = {
  name: 'box_upload_large_file',
  description: 'Upload large files using chunked upload sessions',
  inputSchema: {
    type: 'object',
    properties: {
      contentUrl: {
        type: 'string',
        description: 'URL of large file to upload'
      },
      fileName: {
        type: 'string',
        description: 'Name for the uploaded file'
      },
      fileSize: {
        type: 'number',
        description: 'Total file size in bytes'
      },
      parentId: {
        type: 'string',
        description: 'Parent folder ID',
        default: '0'
      },
      chunkSize: {
        type: 'number',
        description: 'Size of each chunk in bytes',
        default: 8388608 // 8MB default
      }
    },
    required: ['contentUrl', 'fileName', 'fileSize']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      // Create upload session
      const session = await boxClient.files.createUploadSession({
        file_name: args.fileName,
        file_size: args.fileSize,
        folder_id: args.parentId
      });

      // Calculate chunks
      const totalParts = Math.ceil(args.fileSize / args.chunkSize);
      const uploadedParts = [];

      // Upload chunks
      for (let i = 0; i < totalParts; i++) {
        const start = i * args.chunkSize;
        const end = Math.min(start + args.chunkSize, args.fileSize);

        // Get chunk from URL (with range header)
        const chunkData = await fetchChunkFromUrl(
          args.contentUrl,
          start,
          end - 1
        );

        // Upload chunk
        const part = await boxClient.files.uploadPart(
          session.id,
          chunkData,
          {
            offset: start,
            total_size: args.fileSize
          }
        );

        uploadedParts.push(part);

        // Report progress
        context.reportProgress({
          current: i + 1,
          total: totalParts,
          message: `Uploaded part ${i + 1}/${totalParts}`
        });
      }

      // Commit upload session
      const file = await boxClient.files.commitUploadSession(
        session.id,
        {
          parts: uploadedParts,
          attributes: {
            name: args.fileName,
            parent: { id: args.parentId }
          }
        }
      );

      return {
        success: true,
        file: {
          id: file.id,
          name: file.name,
          size: file.size,
          created_at: file.created_at
        }
      };
    } catch (error) {
      // Abort session on error
      if (session?.id) {
        await boxClient.files.abortUploadSession(session.id);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

#### 4. File Management Tools (`src/tools/files/management.ts`)
```typescript
export const getFileInfoTool: Tool = {
  name: 'box_get_file_info',
  description: 'Get detailed information about a file',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific fields to retrieve'
      }
    },
    required: ['fileId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const fileInfo = await boxClient.files.get(
        args.fileId,
        { fields: args.fields?.join(',') }
      );

      return {
        success: true,
        file: {
          id: fileInfo.id,
          name: fileInfo.name,
          size: fileInfo.size,
          description: fileInfo.description,
          created_at: fileInfo.created_at,
          modified_at: fileInfo.modified_at,
          created_by: fileInfo.created_by,
          parent: fileInfo.parent,
          sha1: fileInfo.sha1,
          shared_link: fileInfo.shared_link,
          permissions: fileInfo.permissions,
          tags: fileInfo.tags,
          extension: fileInfo.extension,
          version_number: fileInfo.version_number
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

export const deleteFileTool: Tool = {
  name: 'box_delete_file',
  description: 'Delete a file from Box',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      permanent: {
        type: 'boolean',
        description: 'Permanently delete (skip trash)',
        default: false
      }
    },
    required: ['fileId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      if (args.permanent) {
        await boxClient.files.deletePermanently(args.fileId);
      } else {
        await boxClient.files.delete(args.fileId);
      }

      return {
        success: true,
        message: `File ${args.fileId} deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const copyFileTool: Tool = {
  name: 'box_copy_file',
  description: 'Create a copy of a file',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Source file ID'
      },
      destinationFolderId: {
        type: 'string',
        description: 'Destination folder ID'
      },
      newName: {
        type: 'string',
        description: 'New name for the copy (optional)'
      }
    },
    required: ['fileId', 'destinationFolderId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const copiedFile = await boxClient.files.copy(args.fileId, {
        parent: { id: args.destinationFolderId },
        name: args.newName
      });

      return {
        success: true,
        file: {
          id: copiedFile.id,
          name: copiedFile.name,
          parent_id: copiedFile.parent.id
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
```

#### 5. Version Management Tools (`src/tools/files/versions.ts`)
```typescript
export const getFileVersionsTool: Tool = {
  name: 'box_get_file_versions',
  description: 'Get all versions of a file',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      }
    },
    required: ['fileId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const versions = await boxClient.files.getVersions(args.fileId);

      return {
        success: true,
        versions: versions.entries.map(v => ({
          id: v.id,
          name: v.name,
          size: v.size,
          created_at: v.created_at,
          modified_at: v.modified_at,
          modified_by: v.modified_by,
          version_number: v.version_number
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const promoteVersionTool: Tool = {
  name: 'box_promote_version',
  description: 'Promote a previous version to current',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'Box file ID'
      },
      versionId: {
        type: 'string',
        description: 'Version ID to promote'
      }
    },
    required: ['fileId', 'versionId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const promotedVersion = await boxClient.files.promoteVersion(
        args.fileId,
        args.versionId
      );

      return {
        success: true,
        version: {
          id: promotedVersion.id,
          version_number: promotedVersion.version_number,
          promoted_at: new Date().toISOString()
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
```

### Box Client Service (`src/services/box-client.ts`)
```typescript
import BoxSDK from 'box-node-sdk';
import { AuthManager } from '../auth';

export class BoxClient {
  private static instance: BoxClient;
  private client: any;

  private constructor(private auth: AuthManager) {}

  static async getInstance(context: any): Promise<BoxClient> {
    if (!BoxClient.instance) {
      const auth = context.auth || new AuthManager();
      BoxClient.instance = new BoxClient(auth);
      await BoxClient.instance.initialize();
    }
    return BoxClient.instance.client;
  }

  private async initialize(): Promise<void> {
    const accessToken = await this.auth.getAccessToken();

    const sdk = new BoxSDK({
      clientID: process.env.BOX_CLIENT_ID,
      clientSecret: process.env.BOX_CLIENT_SECRET
    });

    this.client = sdk.getBasicClient(accessToken);
  }

  get files() {
    return this.client.files;
  }

  get folders() {
    return this.client.folders;
  }

  get search() {
    return this.client.search;
  }
}
```

### Utility Functions

#### Stream Utilities (`src/utils/stream.ts`)
```typescript
export async function fetchContentFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function fetchChunkFromUrl(
  url: string,
  start: number,
  end: number
): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'Range': `bytes=${start}-${end}`
    }
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch chunk: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

### Testing Strategy

#### Unit Tests for Each Tool
```typescript
describe('File Operations', () => {
  describe('uploadFileTool', () => {
    it('should upload text file successfully', async () => {
      const result = await uploadFileTool.handler({
        content: 'Hello World',
        fileName: 'test.txt',
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.file.name).toBe('test.txt');
    });

    it('should upload base64 file successfully', async () => {
      const base64Content = 'data:image/png;base64,iVBORw0KG...';
      const result = await uploadFileTool.handler({
        content: base64Content,
        fileName: 'image.png',
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle upload errors', async () => {
      const result = await uploadFileTool.handler({
        content: 'test',
        fileName: '', // Invalid
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Large File Upload', () => {
    it('should handle chunked upload', async () => {
      const result = await uploadLargeFileTool.handler({
        contentUrl: 'https://example.com/large-file.zip',
        fileName: 'large-file.zip',
        fileSize: 104857600, // 100MB
        chunkSize: 8388608   // 8MB chunks
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
    });
  });
});
```

#### API Testing Commands
```bash
# Test file upload
echo '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"box_upload_file","arguments":{"content":"Hello World","fileName":"test.txt","parentId":"0"}}}' | node dist/index.js

# Test file download
echo '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"box_download_file","arguments":{"fileId":"123456789","asText":true}}}' | node dist/index.js

# Test file info
echo '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"box_get_file_info","arguments":{"fileId":"123456789"}}}' | node dist/index.js
```

## Success Criteria

### Functional Requirements
- [ ] All 12 file operation tools implemented
- [ ] Upload supports text and binary files
- [ ] Download returns base64 or text content
- [ ] Large file chunking works for files >50MB
- [ ] Version management operational
- [ ] File metadata retrieval complete

### Performance Requirements
- [ ] Upload speed >5MB/s
- [ ] Chunk size optimization
- [ ] Efficient memory usage (streaming)
- [ ] Parallel chunk uploads

### Quality Requirements
- [ ] 90%+ test coverage
- [ ] Error handling for all edge cases
- [ ] Input validation on all tools
- [ ] Comprehensive logging

## Completion Checklist

- [ ] All 12 tools implemented
- [ ] Box client service created
- [ ] Stream utilities implemented
- [ ] Input validation complete
- [ ] Unit tests written and passing
- [ ] Integration tests with Box API
- [ ] Performance testing completed
- [ ] Error handling comprehensive
- [ ] Documentation updated
- [ ] Code review passed
- [ ] Ready for integration

## Notes

- Consider implementing progress callbacks for large files
- Add retry logic for network failures
- Plan for resume capability on interrupted uploads
- Consider caching file metadata