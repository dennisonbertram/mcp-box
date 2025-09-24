import type { BoxClient as IBoxClient } from '../types.js';
import { BoxClient, BoxDeveloperTokenAuth } from 'box-node-sdk';

export class RealBoxClient implements IBoxClient {
  private client: BoxClient;

  constructor(env: Record<string, string | undefined>) {
    const developerToken = env.BOX_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('RealBoxClient requires BOX_DEVELOPER_TOKEN or OAuth/CCG configuration');
    }
    const auth = new BoxDeveloperTokenAuth({ token: developerToken });
    this.client = new BoxClient({ auth });
  }

  async ensureFolderPath(path: string, description?: string): Promise<string> {
    const parts = path.split('/').filter(Boolean);
    let parentId = '0';
    for (const name of parts) {
      const existing = await this.findChildFolder(parentId, name);
      if (existing) {
        parentId = existing;
        continue;
      }
      const created = await this.client.folders.createFolder({ name, parent: { id: parentId } });
      parentId = (created as any).id;
    }
    return parentId;
  }

  private async findChildFolder(parentId: string, name: string): Promise<string | null> {
    let offset = 0;
    const limit = 1000;
    while (true) {
      const items = await this.client.folders.getFolderItems(parentId, { queryParams: { offset, limit, fields: ['id', 'name', 'type'] } });
      const entries = (items as any).entries ?? [];
      const match = entries.find((e: any) => e.type === 'folder' && e.name === name);
      if (match) return match.id;
      if (entries.length < limit) break;
      offset += limit;
    }
    return null;
  }

  async resolveFolderPath(path: string): Promise<string | null> {
    const parts = path.split('/').filter(Boolean);
    let currentId = '0';
    for (const name of parts) {
      const folderId = await this.findChildFolder(currentId, name);
      if (!folderId) return null;
      currentId = folderId;
    }
    return currentId;
  }

  async listFolderItems(folderId: string) {
    const entries: any[] = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      const items = await this.client.folders.getFolderItems(folderId, { queryParams: { offset, limit, fields: ['id', 'name', 'type', 'size', 'modified_at'] } });
      const arr = (items as any).entries ?? [];
      for (const it of arr) {
        if (it.type === 'folder') entries.push({ id: it.id, name: it.name, type: 'folder', modified: it.modified_at });
        if (it.type === 'file') entries.push({ id: it.id, name: it.name, type: 'file', size: it.size, modified: it.modified_at });
      }
      if (arr.length < limit) break;
      offset += limit;
    }
    return entries;
  }

  async moveFolder(folderId: string, newParentId: string) {
    await (this.client.folders as any).updateFolderById(folderId, { parent: { id: newParentId } });
  }

  async renameFolder(folderId: string, newName: string) {
    await (this.client.folders as any).updateFolderById(folderId, { name: newName });
  }

  async deleteFolder(folderId: string, recursive: boolean = true) {
    await (this.client.folders as any).deleteFolderById(folderId, { queryParams: { recursive } });
  }

  async checkFileExists(parentId: string, fileName: string) {
    let offset = 0;
    const limit = 1000;
    while (true) {
      const items = await this.client.folders.getFolderItems(parentId, { queryParams: { offset, limit, fields: ['id', 'name', 'type', 'size'] } });
      const entries = (items as any).entries ?? [];
      const match = entries.find((e: any) => e.type === 'file' && e.name === fileName);
      if (match) return { id: match.id, size: match.size };
      if (entries.length < limit) break;
      offset += limit;
    }
    return null;
  }

  async uploadFile(parentId: string, fileName: string, content: Buffer) {
    const uploaded = await this.client.uploads.uploadFile({
      attributes: { name: fileName, parent: { id: parentId } },
      file: content as any,
      fileFileName: fileName
    } as any);
    const file = (uploaded as any).entries?.[0] ?? uploaded;
    return { id: (file as any).id, size: (file as any).size } as any;
  }

  async getFileByPath(path: string) {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return null;
    let parentId = '0';
    for (const name of parts) {
      const folderId = await this.findChildFolder(parentId, name);
      if (!folderId) return null;
      parentId = folderId;
    }
    const exists = await this.checkFileExists(parentId, fileName);
    if (!exists) return null;
    const content = await this.getFileContent(exists.id);
    return { id: exists.id, name: fileName, size: content.byteLength, content };
  }

  async getFileContent(fileId: string) {
    const byteStream = await this.client.downloads.downloadFile(fileId);
    if (!byteStream) return Buffer.alloc(0);
    if (Buffer.isBuffer(byteStream)) return byteStream as Buffer;
    if (typeof byteStream === 'string') return Buffer.from(byteStream);
    // Assume Readable stream
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      (byteStream as any).on('data', (d: Buffer) => chunks.push(d));
      (byteStream as any).on('end', () => resolve());
      (byteStream as any).on('error', reject);
    });
    return Buffer.concat(chunks);
  }

  async createSharedLink(params: { itemType: 'file' | 'folder'; itemId: string; access?: 'open' | 'company' | 'collaborators'; password?: string | null; canDownload?: boolean; unsharedAt?: string | null }) {
    if (params.itemType === 'file') {
      const body: any = { sharedLink: { access: params.access, password: params.password ?? undefined, unsharedAt: params.unsharedAt ?? undefined, permissions: { canDownload: params.canDownload } } };
      const res: any = await (this.client.sharedLinksFiles as any).addShareLinkToFile(params.itemId, body, { fields: 'shared_link' });
      return { url: res.sharedLink?.url, access: res.sharedLink?.access, unsharedAt: res.sharedLink?.unsharedAt };
    } else {
      const body: any = { sharedLink: { access: params.access, password: params.password ?? undefined, unsharedAt: params.unsharedAt ?? undefined, permissions: { canDownload: params.canDownload } } };
      const res: any = await (this.client.sharedLinksFolders as any).addShareLinkToFolder(params.itemId, body, { fields: 'shared_link' });
      return { url: res.sharedLink?.url, access: res.sharedLink?.access, unsharedAt: res.sharedLink?.unsharedAt };
    }
  }

  async addCollaborators(params: { itemType: 'file' | 'folder'; itemId: string; collaborators: { email: string; role: string }[]; notify?: boolean }) {
    const added: { email: string; id?: string; role: string }[] = [];
    for (const c of params.collaborators) {
      const res: any = await (this.client.userCollaborations as any).createCollaboration({
        item: { type: params.itemType, id: params.itemId },
        accessibleBy: { type: 'user', login: c.email },
        role: c.role
      }, { queryParams: { notify: params.notify } });
      added.push({ email: c.email, id: res.id, role: c.role });
    }
    return { added };
  }

  async searchContent(params: {
    query?: string;
    type?: 'file' | 'folder' | 'all';
    extensions?: string[];
    folders?: string[];
    includeContent?: boolean;
    includeTrashed?: boolean;
    limit?: number;
    sortBy?: 'relevance' | 'modified_at';
    direction?: 'DESC' | 'ASC';
  }) {
    // Map to Box SearchForContentQueryParams (per Box docs via Context7)
    const q: any = {};
    if (params.query) q.query = params.query;
    if (params.type && params.type !== 'all') q.type = params.type;
    if (params.extensions?.length) q.fileExtensions = params.extensions;
    if (params.limit) q.limit = params.limit;
    if (params.sortBy) q.sort = params.sortBy;
    if (params.direction && params.sortBy === 'modified_at') q.direction = params.direction;
    q.trashContent = params.includeTrashed ? 'all_items' : 'non_trashed_only';
    if (params.folders?.length) {
      const ids: string[] = [];
      for (const p of params.folders) {
        const id = await this.resolveFolderPath(p);
        if (id) ids.push(id);
      }
      if (ids.length) q.ancestorFolderIds = ids;
    }
    const res: any = await this.client.search.searchForContent(q);
    const entries = (res.entries || []).map((item: any) => {
      const type = item.type as 'file' | 'folder' | 'web_link';
      const path = item.pathCollection?.entries?.map((e: any) => e.name).join('/') || undefined;
      return {
        id: item.id,
        type: type === 'web_link' ? 'file' : (type as any),
        name: item.name,
        path,
        size: item.size,
        modified: item.modifiedAt || item.contentModifiedAt
      };
    });
    return { totalCount: res.totalCount || entries.length, entries };
  }
}

export default RealBoxClient;
