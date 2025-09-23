# Task 0003: Folder Management & Sharing Tools

## Overview

This task implements folder management and sharing/collaboration tools for the Box MCP server, enabling comprehensive folder operations and secure sharing capabilities.

## Dependencies

- Task 0001: Authentication System & Server Foundation (must be complete)
- Task 0002: File Operations (recommended but not required)

## Deliverables

### Folder Operations (10 tools)
1. **box_create_folder** - Create new folder
2. **box_list_folder** - List folder contents
3. **box_get_folder_info** - Get folder metadata
4. **box_delete_folder** - Delete folder
5. **box_copy_folder** - Copy folder
6. **box_move_folder** - Move folder
7. **box_rename_folder** - Rename folder
8. **box_get_folder_tree** - Get folder hierarchy
9. **box_create_folder_path** - Create nested folders
10. **box_get_storage_info** - Get storage usage

### Sharing & Collaboration Tools (8 tools)
1. **box_create_shared_link** - Create shared link
2. **box_get_shared_link** - Get shared link info
3. **box_update_shared_link** - Update link settings
4. **box_delete_shared_link** - Remove shared link
5. **box_add_collaborator** - Add collaborator
6. **box_remove_collaborator** - Remove collaborator
7. **box_update_collaboration** - Update permissions
8. **box_get_collaborations** - List collaborators

## Implementation Details

### File Structure
```
src/tools/
├── folders/
│   ├── management.ts      # Folder CRUD operations
│   ├── navigation.ts      # Tree and path operations
│   └── storage.ts         # Storage info
└── sharing/
    ├── links.ts           # Shared link management
    └── collaborations.ts  # Collaboration management
```

### Folder Management Tools

#### 1. Create Folder Tool (`src/tools/folders/management.ts`)
```typescript
import { Tool } from '@modelcontextprotocol/sdk';
import { BoxClient } from '../../services/box-client';

export const createFolderTool: Tool = {
  name: 'box_create_folder',
  description: 'Create a new folder in Box',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Folder name'
      },
      parentId: {
        type: 'string',
        description: 'Parent folder ID (0 for root)',
        default: '0'
      },
      description: {
        type: 'string',
        description: 'Folder description'
      },
      sharedLink: {
        type: 'object',
        description: 'Shared link settings',
        properties: {
          access: {
            type: 'string',
            enum: ['open', 'company', 'collaborators'],
            description: 'Access level'
          },
          password: {
            type: 'string',
            description: 'Password for shared link'
          },
          unsharedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Expiration date'
          }
        }
      }
    },
    required: ['name']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const folderData: any = {
        name: args.name,
        parent: { id: args.parentId }
      };

      if (args.description) {
        folderData.description = args.description;
      }

      if (args.sharedLink) {
        folderData.shared_link = {
          access: args.sharedLink.access,
          password: args.sharedLink.password,
          unshared_at: args.sharedLink.unsharedAt
        };
      }

      const folder = await boxClient.folders.create(folderData);

      return {
        success: true,
        folder: {
          id: folder.id,
          name: folder.name,
          path: folder.path_collection?.entries.map(e => e.name).join('/'),
          created_at: folder.created_at,
          shared_link: folder.shared_link
        }
      };
    } catch (error) {
      if (error.statusCode === 409) {
        return {
          success: false,
          error: 'Folder with this name already exists'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const listFolderTool: Tool = {
  name: 'box_list_folder',
  description: 'List contents of a folder',
  inputSchema: {
    type: 'object',
    properties: {
      folderId: {
        type: 'string',
        description: 'Folder ID (0 for root)',
        default: '0'
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to include in response'
      },
      limit: {
        type: 'number',
        description: 'Maximum items to return',
        default: 100
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        default: 0
      },
      sort: {
        type: 'string',
        enum: ['name', 'date', 'size'],
        description: 'Sort order'
      },
      direction: {
        type: 'string',
        enum: ['ASC', 'DESC'],
        default: 'ASC'
      }
    }
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const items = await boxClient.folders.getItems(
        args.folderId || '0',
        {
          fields: args.fields?.join(','),
          limit: args.limit,
          offset: args.offset,
          sort: args.sort,
          direction: args.direction
        }
      );

      const formattedItems = items.entries.map(item => ({
        id: item.id,
        type: item.type,
        name: item.name,
        size: item.size,
        modified_at: item.modified_at,
        created_at: item.created_at,
        shared_link: item.shared_link
      }));

      return {
        success: true,
        items: formattedItems,
        total_count: items.total_count,
        offset: items.offset,
        limit: items.limit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const deleteFolderTool: Tool = {
  name: 'box_delete_folder',
  description: 'Delete a folder and its contents',
  inputSchema: {
    type: 'object',
    properties: {
      folderId: {
        type: 'string',
        description: 'Folder ID to delete'
      },
      recursive: {
        type: 'boolean',
        description: 'Delete folder even if not empty',
        default: true
      },
      permanent: {
        type: 'boolean',
        description: 'Permanently delete (skip trash)',
        default: false
      }
    },
    required: ['folderId']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      if (args.permanent) {
        await boxClient.folders.deletePermanently(
          args.folderId,
          { recursive: args.recursive }
        );
      } else {
        await boxClient.folders.delete(
          args.folderId,
          { recursive: args.recursive }
        );
      }

      return {
        success: true,
        message: `Folder ${args.folderId} deleted successfully`
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

#### 2. Folder Navigation Tools (`src/tools/folders/navigation.ts`)
```typescript
export const getFolderTreeTool: Tool = {
  name: 'box_get_folder_tree',
  description: 'Get complete folder hierarchy',
  inputSchema: {
    type: 'object',
    properties: {
      folderId: {
        type: 'string',
        description: 'Starting folder ID',
        default: '0'
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse',
        default: 3
      },
      includeFiles: {
        type: 'boolean',
        description: 'Include files in tree',
        default: false
      }
    }
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    async function buildTree(folderId: string, currentDepth: number): Promise<any> {
      if (currentDepth > args.depth) {
        return null;
      }

      const folder = await boxClient.folders.get(folderId);
      const items = await boxClient.folders.getItems(folderId);

      const tree: any = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        path: folder.path_collection?.entries.map(e => e.name).join('/'),
        children: []
      };

      for (const item of items.entries) {
        if (item.type === 'folder') {
          const subtree = await buildTree(item.id, currentDepth + 1);
          if (subtree) {
            tree.children.push(subtree);
          }
        } else if (args.includeFiles && item.type === 'file') {
          tree.children.push({
            id: item.id,
            name: item.name,
            type: 'file',
            size: item.size
          });
        }
      }

      return tree;
    }

    try {
      const tree = await buildTree(args.folderId || '0', 0);

      return {
        success: true,
        tree: tree
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const createFolderPathTool: Tool = {
  name: 'box_create_folder_path',
  description: 'Create nested folder structure',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Folder path to create (e.g., "Projects/2024/Q1")'
      },
      parentId: {
        type: 'string',
        description: 'Starting parent folder ID',
        default: '0'
      }
    },
    required: ['path']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const pathParts = args.path.split('/').filter(p => p.length > 0);
      let currentParentId = args.parentId || '0';
      const createdFolders = [];

      for (const folderName of pathParts) {
        try {
          // Try to create folder
          const folder = await boxClient.folders.create({
            name: folderName,
            parent: { id: currentParentId }
          });

          createdFolders.push({
            id: folder.id,
            name: folder.name
          });

          currentParentId = folder.id;
        } catch (error) {
          if (error.statusCode === 409) {
            // Folder exists, find it
            const items = await boxClient.folders.getItems(currentParentId);
            const existingFolder = items.entries.find(
              item => item.type === 'folder' && item.name === folderName
            );

            if (existingFolder) {
              currentParentId = existingFolder.id;
              createdFolders.push({
                id: existingFolder.id,
                name: existingFolder.name,
                existed: true
              });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      return {
        success: true,
        path: args.path,
        folders: createdFolders,
        finalFolderId: currentParentId
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

#### 3. Sharing Tools (`src/tools/sharing/links.ts`)
```typescript
export const createSharedLinkTool: Tool = {
  name: 'box_create_shared_link',
  description: 'Create a shared link for a file or folder',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'File or folder ID'
      },
      itemType: {
        type: 'string',
        enum: ['file', 'folder'],
        description: 'Type of item'
      },
      access: {
        type: 'string',
        enum: ['open', 'company', 'collaborators'],
        description: 'Access level for the link',
        default: 'company'
      },
      password: {
        type: 'string',
        description: 'Password protection (optional)'
      },
      unsharedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Expiration date (optional)'
      },
      permissions: {
        type: 'object',
        properties: {
          canDownload: {
            type: 'boolean',
            default: true
          },
          canPreview: {
            type: 'boolean',
            default: true
          },
          canEdit: {
            type: 'boolean',
            default: false
          }
        }
      }
    },
    required: ['itemId', 'itemType']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const sharedLinkData = {
        access: args.access,
        password: args.password,
        unshared_at: args.unsharedAt,
        permissions: args.permissions
      };

      let item;
      if (args.itemType === 'file') {
        item = await boxClient.files.update(args.itemId, {
          shared_link: sharedLinkData
        });
      } else {
        item = await boxClient.folders.update(args.itemId, {
          shared_link: sharedLinkData
        });
      }

      return {
        success: true,
        sharedLink: {
          url: item.shared_link.url,
          downloadUrl: item.shared_link.download_url,
          access: item.shared_link.access,
          effectiveAccess: item.shared_link.effective_access,
          effectivePermission: item.shared_link.effective_permission,
          isPasswordEnabled: item.shared_link.is_password_enabled,
          unsharedAt: item.shared_link.unshared_at,
          downloadCount: item.shared_link.download_count,
          previewCount: item.shared_link.preview_count
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

export const updateSharedLinkTool: Tool = {
  name: 'box_update_shared_link',
  description: 'Update settings of an existing shared link',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'File or folder ID'
      },
      itemType: {
        type: 'string',
        enum: ['file', 'folder'],
        description: 'Type of item'
      },
      access: {
        type: 'string',
        enum: ['open', 'company', 'collaborators'],
        description: 'New access level'
      },
      password: {
        type: 'string',
        description: 'New password (null to remove)'
      },
      unsharedAt: {
        type: 'string',
        format: 'date-time',
        description: 'New expiration date'
      },
      permissions: {
        type: 'object',
        properties: {
          canDownload: { type: 'boolean' },
          canPreview: { type: 'boolean' },
          canEdit: { type: 'boolean' }
        }
      }
    },
    required: ['itemId', 'itemType']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const updateData: any = { shared_link: {} };

      if (args.access !== undefined) {
        updateData.shared_link.access = args.access;
      }
      if (args.password !== undefined) {
        updateData.shared_link.password = args.password;
      }
      if (args.unsharedAt !== undefined) {
        updateData.shared_link.unshared_at = args.unsharedAt;
      }
      if (args.permissions !== undefined) {
        updateData.shared_link.permissions = args.permissions;
      }

      let item;
      if (args.itemType === 'file') {
        item = await boxClient.files.update(args.itemId, updateData);
      } else {
        item = await boxClient.folders.update(args.itemId, updateData);
      }

      return {
        success: true,
        sharedLink: {
          url: item.shared_link.url,
          access: item.shared_link.access,
          updated: true
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

#### 4. Collaboration Tools (`src/tools/sharing/collaborations.ts`)
```typescript
export const addCollaboratorTool: Tool = {
  name: 'box_add_collaborator',
  description: 'Add a collaborator to a file or folder',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'File or folder ID'
      },
      itemType: {
        type: 'string',
        enum: ['file', 'folder'],
        description: 'Type of item'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Collaborator email address'
      },
      role: {
        type: 'string',
        enum: ['editor', 'viewer', 'previewer', 'uploader', 'previewer uploader', 'viewer uploader', 'co-owner', 'owner'],
        description: 'Permission level',
        default: 'viewer'
      },
      canViewPath: {
        type: 'boolean',
        description: 'Can view folder path',
        default: false
      },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        description: 'Collaboration expiration date'
      }
    },
    required: ['itemId', 'itemType', 'email']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      const collaborationData = {
        item: {
          id: args.itemId,
          type: args.itemType
        },
        accessible_by: {
          type: 'user',
          login: args.email
        },
        role: args.role,
        can_view_path: args.canViewPath,
        expires_at: args.expiresAt
      };

      const collaboration = await boxClient.collaborations.create(collaborationData);

      return {
        success: true,
        collaboration: {
          id: collaboration.id,
          role: collaboration.role,
          status: collaboration.status,
          accessible_by: collaboration.accessible_by,
          created_at: collaboration.created_at,
          expires_at: collaboration.expires_at
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

export const getCollaborationsTool: Tool = {
  name: 'box_get_collaborations',
  description: 'List all collaborators for an item',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'File or folder ID'
      },
      itemType: {
        type: 'string',
        enum: ['file', 'folder'],
        description: 'Type of item'
      }
    },
    required: ['itemId', 'itemType']
  },

  async handler(args, context) {
    const boxClient = await BoxClient.getInstance(context);

    try {
      let collaborations;

      if (args.itemType === 'file') {
        const file = await boxClient.files.get(args.itemId, {
          fields: 'collaborations'
        });
        collaborations = file.collaborations || [];
      } else {
        const folder = await boxClient.folders.get(args.itemId, {
          fields: 'collaborations'
        });
        collaborations = folder.collaborations || [];
      }

      const formattedCollaborations = collaborations.map(collab => ({
        id: collab.id,
        role: collab.role,
        status: collab.status,
        user: {
          id: collab.accessible_by?.id,
          name: collab.accessible_by?.name,
          email: collab.accessible_by?.login
        },
        created_at: collab.created_at,
        modified_at: collab.modified_at,
        expires_at: collab.expires_at
      }));

      return {
        success: true,
        collaborations: formattedCollaborations
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

### Testing Strategy

#### Unit Tests
```typescript
describe('Folder Operations', () => {
  describe('createFolderTool', () => {
    it('should create folder successfully', async () => {
      const result = await createFolderTool.handler({
        name: 'Test Folder',
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.folder.name).toBe('Test Folder');
    });

    it('should handle duplicate folder names', async () => {
      const result = await createFolderTool.handler({
        name: 'Existing Folder',
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('createFolderPathTool', () => {
    it('should create nested folder structure', async () => {
      const result = await createFolderPathTool.handler({
        path: 'Projects/2024/Q1/Reports',
        parentId: '0'
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.folders).toHaveLength(4);
    });
  });
});

describe('Sharing Operations', () => {
  describe('createSharedLinkTool', () => {
    it('should create shared link with password', async () => {
      const result = await createSharedLinkTool.handler({
        itemId: '123456',
        itemType: 'file',
        access: 'company',
        password: 'secure123'
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.sharedLink.isPasswordEnabled).toBe(true);
    });
  });

  describe('addCollaboratorTool', () => {
    it('should add collaborator with editor role', async () => {
      const result = await addCollaboratorTool.handler({
        itemId: '123456',
        itemType: 'folder',
        email: 'user@example.com',
        role: 'editor'
      }, mockContext);

      expect(result.success).toBe(true);
      expect(result.collaboration.role).toBe('editor');
    });
  });
});
```

## Success Criteria

### Functional Requirements
- [ ] All 18 tools implemented and tested
- [ ] Folder creation with nested paths
- [ ] Comprehensive folder navigation
- [ ] Shared link creation and management
- [ ] Collaboration management
- [ ] Storage info retrieval

### Performance Requirements
- [ ] Folder tree traversal optimized
- [ ] Batch operations support
- [ ] Efficient pagination
- [ ] Caching for frequently accessed folders

### Security Requirements
- [ ] Permission validation
- [ ] Secure password handling
- [ ] Access control enforcement
- [ ] Audit logging for sharing

## Completion Checklist

- [ ] All folder management tools implemented
- [ ] All sharing/collaboration tools implemented
- [ ] Comprehensive error handling
- [ ] Input validation complete
- [ ] Unit tests written and passing
- [ ] Integration tests with Box API
- [ ] Performance optimization done
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Code review passed

## Notes

- Consider implementing folder templates
- Add support for metadata templates on folders
- Plan for bulk collaboration management
- Consider folder activity tracking