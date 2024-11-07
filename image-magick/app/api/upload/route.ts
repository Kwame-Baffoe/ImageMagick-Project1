
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { writeFile, mkdir, stat, readdir, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Define types inline since we can't access the types file
interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  format: string;
  lastModified: Date;
}

interface UploadResponse {
  success: boolean;
  data?: {
    filename: string;
    url: string;
    metadata: ImageMetadata;
  };
  error?: string;
  code?: string;
}

// Rest of your code remains exactly the same
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);


// Custom error class
class FileUploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

// Headers
const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'",
  'X-XSS-Protection': '1; mode=block'
};

// Utility functions
const validateFileType = async (file: File): Promise<boolean> => {
  try {
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
      return false;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSignature = Array.from(buffer.slice(0, 4));

    const signatures = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      webp: [0x52, 0x49, 0x46, 0x46]
    };

    return (
      fileSignature.slice(0, 3).every((byte, i) => byte === signatures.jpeg[i]) ||
      fileSignature.every((byte, i) => byte === signatures.png[i]) ||
      fileSignature.slice(0, 4).every((byte, i) => byte === signatures.webp[i])
    );
  } catch (error) {
    console.error('File validation error:', error);
    return false;
  }
};

const ensureUploadDirectory = async (): Promise<void> => {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
};

const generateSafeFilename = (originalName: string): string => {
  const extension = path.extname(originalName);
  const baseFilename = path.basename(originalName, extension)
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  return `${baseFilename}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
};

const cleanupOldFiles = async (): Promise<void> => {
  try {
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();

    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = await stat(filePath);
        if (now - stats.mtimeMs > MAX_AGE) {
          await unlink(filePath);
        }
      })
    );
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

// Rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimit.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > userLimit.resetTime) {
    userLimit.count = 1;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  } else if (userLimit.count >= MAX_REQUESTS) {
    return false;
  } else {
    userLimit.count++;
  }

  rateLimit.set(ip, userLimit);
  return true;
};

// Request handlers
export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      throw new FileUploadError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
    }

    await ensureUploadDirectory();

    const data = await req.formData();
    const file = data.get('file');

    if (!file || !(file instanceof File)) {
      throw new FileUploadError('No file provided', 'INVALID_FILE', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new FileUploadError(
        `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        'FILE_TOO_LARGE',
        400
      );
    }

    if (!(await validateFileType(file))) {
      throw new FileUploadError(
        'Invalid file type. Only JPEG, PNG, and WebP allowed.',
        'INVALID_FILE_TYPE',
        400
      );
    }

    const filename = generateSafeFilename(file.name);
    const filepath = path.join(UPLOAD_DIR, filename);

    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));
    const stats = await stat(filepath);

    // Create metadata for frontend
    const metadata: ImageMetadata = {
      width: 0, // You might want to add image processing to get these
      height: 0,
      size: stats.size,
      format: path.extname(filename).slice(1).toUpperCase(),
      lastModified: new Date(stats.mtime)
    };

    await cleanupOldFiles();

    return NextResponse.json({
      success: true,
      data: {
        filename,
        url: `/uploads/${filename}`,
        metadata
      }
    }, { headers: baseHeaders });

  } catch (error) {
    console.error('Upload error:', error);
    
    const statusCode = error instanceof FileUploadError ? error.statusCode : 500;
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    const errorCode = error instanceof FileUploadError ? error.code : 'UNKNOWN_ERROR';

    return NextResponse.json({
      success: false,
      error: errorMessage,
      code: errorCode
    }, { 
      status: statusCode,
      headers: baseHeaders 
    });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: baseHeaders,
  });
}