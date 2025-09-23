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
}

export default RealBoxClient;
