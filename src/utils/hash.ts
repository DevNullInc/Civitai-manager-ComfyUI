import crypto from 'crypto';
import fs from 'fs';

export interface HashProgressCallback {
  (bytesProcessed: number, totalBytes: number): void;
}

export async function computeFileSHA256(
  filePath: string,
  onProgress?: HashProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const stats = fs.statSync(filePath);
      const totalBytes = stats.size;
      let bytesProcessed = 0;

      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 }); // 4MB chunks

      stream.on('data', (chunk: Buffer | string) => {
        hash.update(chunk);
        const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        bytesProcessed += len;
        if (onProgress) {
          onProgress(bytesProcessed, totalBytes);
        }
      });

      stream.on('end', () => {
        resolve(hash.digest('hex').toUpperCase());
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
