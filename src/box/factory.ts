import { InMemoryBoxClient } from './boxClient.js';
import type { BoxClient } from '../types.js';

export async function createBoxClient(env: Record<string, string | undefined>): Promise<BoxClient> {
  const useMock = env.NODE_ENV === 'test' || env.BOX_USE_MOCK === 'true' || !env.BOX_DEVELOPER_TOKEN;
  if (useMock) return new InMemoryBoxClient();
  const { RealBoxClient } = await import('./realBoxClient.js');
  return new RealBoxClient(env) as any;
}
