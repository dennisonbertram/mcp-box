import { BoxClient as IBoxClient } from '../types.js';

export class InMemoryBoxClient implements IBoxClient {
  private folders: Map<string, { id: string; parentId: string | null; name: string; path: string; description?: string }>; 
  private files: Map<string, { id: string; parentId: string; name: string; size: number; content: Buffer }>; 

  constructor() {
    this.folders = new Map();
    this.files = new Map();
    this.folders.set('0', { id: '0', parentId: null, name: '', path: '/' });
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
      this.folders.set(id, { id, parentId: currentId, name: part, path: currentPath, description });
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
      this.files.set(id, rec);
      return { id, size: rec.size };
    }
    const id = `fil_${this.files.size + 1}`;
    const size = content.byteLength;
    this.files.set(id, { id, parentId, name: fileName, content, size });
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
}
