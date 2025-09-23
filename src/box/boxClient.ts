import { BoxClient as IBoxClient } from '../types.js';

export class InMemoryBoxClient implements IBoxClient {
  private folders: Map<string, { id: string; parentId: string | null; name: string; path: string; description?: string; modified: string }>; 
  private files: Map<string, { id: string; parentId: string; name: string; size: number; content: Buffer; modified: string }>; 

  constructor() {
    this.folders = new Map();
    this.files = new Map();
    this.folders.set('0', { id: '0', parentId: null, name: '', path: '/', modified: new Date().toISOString() });
  }

  async ensureFolderPath(path: string, description?: string): Promise<string> {
    const parts = path.split('/').filter(Boolean);
    let currentId = '0';
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      const existing = [...this.folders.values()].find(
        (f) => f.parentId === currentId && f.name === part
      );
      if (existing) {
        currentId = existing.id;
        continue;
      }
      const id = `fld_${this.folders.size + 1}`;
      this.folders.set(id, { id, parentId: currentId, name: part, path: currentPath, description, modified: new Date().toISOString() });
      currentId = id;
    }
    return currentId;
  }

  async checkFileExists(parentId: string, fileName: string) {
    const found = [...this.files.values()].find((f) => f.parentId === parentId && f.name === fileName);
    return found ? { id: found.id, size: found.size } : null;
  }

  async uploadFile(parentId: string, fileName: string, content: Buffer) {
    const existing = await this.checkFileExists(parentId, fileName);
    if (existing) {
      const id = existing.id;
      const rec = this.files.get(id)!;
      rec.content = content;
      rec.size = content.byteLength;
      rec.modified = new Date().toISOString();
      this.files.set(id, rec);
      return { id, size: rec.size };
    }
    const id = `fil_${this.files.size + 1}`;
    const size = content.byteLength;
    this.files.set(id, { id, parentId, name: fileName, content, size, modified: new Date().toISOString() });
    return { id, size };
  }

  async getFileByPath(path: string) {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return null;
    // Walk folders
    let parentId = '0';
    for (const part of parts) {
      const next = [...this.folders.values()].find((f) => f.parentId === parentId && f.name === part);
      if (!next) return null;
      parentId = next.id;
    }
    const file = [...this.files.values()].find((f) => f.parentId === parentId && f.name === fileName);
    return file ? { id: file.id, name: file.name, size: file.size, content: file.content } : null;
  }

  async getFileContent(fileId: string) {
    const f = this.files.get(fileId);
    if (!f) throw new Error('File not found');
    return f.content;
  }

  async resolveFolderPath(path: string): Promise<string | null> {
    const parts = path.split('/').filter(Boolean);
    let currentId = '0';
    for (const part of parts) {
      const next = [...this.folders.values()].find((f) => f.parentId === currentId && f.name === part);
      if (!next) return null;
      currentId = next.id;
    }
    return currentId;
  }

  async listFolderItems(folderId: string) {
    const entries: { id: string; name: string; type: 'file' | 'folder'; size?: number; modified?: string }[] = [];
    for (const f of this.folders.values()) {
      if (f.parentId === folderId) {
        entries.push({ id: f.id, name: f.name, type: 'folder', modified: f.modified });
      }
    }
    for (const file of this.files.values()) {
      if (file.parentId === folderId) {
        entries.push({ id: file.id, name: file.name, type: 'file', size: file.size, modified: file.modified });
      }
    }
    return entries;
  }

  private updatePathsRecursively(folderId: string, newParentPath: string) {
    const folder = this.folders.get(folderId);
    if (!folder) return;
    folder.path = newParentPath ? `${newParentPath}/${folder.name}` : `/${folder.name}`;
    folder.modified = new Date().toISOString();
    this.folders.set(folderId, folder);
    for (const child of this.folders.values()) {
      if (child.parentId === folderId) {
        this.updatePathsRecursively(child.id, folder.path);
      }
    }
    for (const file of this.files.values()) {
      if (file.parentId === folderId) {
        file.modified = new Date().toISOString();
        this.files.set(file.id, file);
      }
    }
  }

  async moveFolder(folderId: string, newParentId: string) {
    const folder = this.folders.get(folderId);
    const parent = this.folders.get(newParentId);
    if (!folder || !parent) throw new Error('Folder or parent not found');
    folder.parentId = newParentId;
    this.folders.set(folderId, folder);
    this.updatePathsRecursively(folderId, parent.path);
  }

  async renameFolder(folderId: string, newName: string) {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error('Folder not found');
    const parent = folder.parentId ? this.folders.get(folder.parentId) : null;
    folder.name = newName;
    this.folders.set(folderId, folder);
    this.updatePathsRecursively(folderId, parent?.path || '');
  }

  async deleteFolder(folderId: string, recursive: boolean = true) {
    // Remove descendants
    for (const child of [...this.folders.values()]) {
      if (child.parentId === folderId) {
        if (!recursive) throw new Error('Folder not empty');
        await this.deleteFolder(child.id, true);
      }
    }
    for (const file of [...this.files.values()]) {
      if (file.parentId === folderId) {
        this.files.delete(file.id);
      }
    }
    this.folders.delete(folderId);
  }

  private folderPath(id: string): string {
    const f = this.folders.get(id);
    return f?.path || '/';
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
    const q = (params.query || '').toLowerCase();
    const wantType = params.type && params.type !== 'all' ? params.type : undefined;
    const extSet = new Set((params.extensions || []).map((e) => e.toLowerCase()));
    const folderPaths = params.folders || [];
    const inFolders = new Set<string>();
    for (const p of folderPaths) {
      const id = await this.resolveFolderPath(p);
      if (id) inFolders.add(id);
    }
    const entries: { id: string; type: 'file' | 'folder'; name: string; path?: string; size?: number; modified?: string }[] = [];

    // Folders
    for (const f of this.folders.values()) {
      if (f.id === '0') continue;
      if (wantType && wantType !== 'folder') continue;
      const name = f.name;
      const path = f.path;
      const matchQuery = q ? name.toLowerCase().includes(q) : true;
      const within = inFolders.size ? [...inFolders].some((ancestor) => path.startsWith(this.folderPath(ancestor))) : true;
      if (matchQuery && within) {
        entries.push({ id: f.id, type: 'folder', name, path, modified: f.modified });
      }
    }

    // Files
    for (const file of this.files.values()) {
      if (wantType && wantType !== 'file') continue;
      const name = file.name;
      const folderPath = this.folderPath(file.parentId);
      const path = `${folderPath === '/' ? '' : folderPath}/${name}`;
      // ext filter
      if (extSet.size) {
        const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
        if (!extSet.has(ext)) continue;
      }
      // folder filter
      const within = inFolders.size ? [...inFolders].some((ancestor) => path.startsWith(this.folderPath(ancestor))) : true;
      // query: name or content when includeContent
      let matchQuery = true;
      if (q) {
        matchQuery = name.toLowerCase().includes(q) || (params.includeContent ? file.content.toString('utf8').toLowerCase().includes(q) : false);
      }
      if (matchQuery && within) {
        entries.push({ id: file.id, type: 'file', name, path, size: file.size, modified: file.modified });
      }
    }

    // simple sort support
    if (params.sortBy === 'modified_at') {
      entries.sort((a, b) => new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime());
    } else {
      // relevance or default: keep insertion order
    }
    const limit = params.limit || 20;
    return { totalCount: entries.length, entries: entries.slice(0, limit) };
  }
}
