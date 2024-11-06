// src/utils/cleanup.ts
import { readdir, unlink, stat } from 'fs/promises';
import path from 'path';


const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function cleanupUploads() {
  try {
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();

    await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(UPLOAD_DIR, filename);
        const stats = await stat(filepath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE) {
          try {
            await unlink(filepath);
            console.log(`Cleaned up old file: ${filename}`);
          } catch (error) {
            console.error(`Failed to delete file ${filename}:`, error);
          }
        }
      })
    );
  } catch (error) {
    console.error('Cleanup error:', error);
  }
} 

