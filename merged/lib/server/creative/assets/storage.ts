/* Ticket 092 — object storage boundary. Memory store for tests; Vercel Blob adapter for the owner's staging. */

export interface ObjectStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
}

export class MemoryStore implements ObjectStore {
  files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  constructor(private base = 'https://store.invalid/') {}
  async put(key: string, bytes: Uint8Array, contentType: string) { this.files.set(key, { bytes, contentType }); return { url: this.base + key }; }
}

/** BLOCKED until the owner creates a Blob store and sets BLOB_READ_WRITE_TOKEN (docs/PHASE2_STATUS.md). */
export class VercelBlobStore implements ObjectStore {
  constructor(private token: string) {}
  async put(key: string, bytes: Uint8Array, contentType: string) {
    const { put } = await import('@vercel/blob');
    const r = await put(key, Buffer.from(bytes), { access: 'public', contentType, addRandomSuffix: false, allowOverwrite: false, token: this.token });
    return { url: r.url };
  }
}
