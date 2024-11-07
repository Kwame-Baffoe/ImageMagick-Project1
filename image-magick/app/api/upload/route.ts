// src/app/api/upload/route.ts

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { writeFile, mkdir, stat, readdir, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Type definitions
interface UploadResponse {
  success: boolean;
  filename?: string;
  url?: string;
  size?: number;
  type?: string;
  error?: string;
  details?: string;
}

interface UploadError extends Error {
  code: string;
  statusCode: number;
}

// Custom error class
class FileUploadError extends Error implements UploadError {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'FileUploadError';
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Security headers
const securityHeaders = {
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

    // Check file signature (magic numbers)
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
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${baseFilename}-${uniqueId}${extension}`;
};

const getFileStats = async (filepath: string) => {
  try {
    return await stat(filepath);
  } catch (error) {
    console.error('Error getting file stats:', error);
    return null;
  }
};

const cleanupOldFiles = async () => {
  try {
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    const files = await readdir(UPLOAD_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = await stat(filePath);

      if (now - stats.mtimeMs > MAX_AGE) {
        await unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

// Rate limiting (simple in-memory implementation)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (ip: string): boolean => {
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 100;
  const now = Date.now();

  const userLimit = rateLimit.get(ip) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > userLimit.resetTime) {
    userLimit.count = 1;
    userLimit.resetTime = now + WINDOW_MS;
  } else if (userLimit.count >= MAX_REQUESTS) {
    return false;
  } else {
    userLimit.count++;
  }

  rateLimit.set(ip, userLimit);
  return true;
};

// Main upload handler
export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Check rate limit
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 });
    }

    // Ensure upload directory exists
    await ensureUploadDirectory();

    const data = await req.formData();
    const file = data.get('file');

    // Validate file exists and is a File object
    if (!file || !(file instanceof File)) {
      throw new FileUploadError(
        'No file provided or invalid file format',
        'INVALID_FILE',
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new FileUploadError(
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        'FILE_TOO_LARGE',
        400
      );
    }

    // Validate file type
    if (!(await validateFileType(file))) {
      throw new FileUploadError(
        'Invalid file type. Only JPEG, PNG, and WebP files are allowed.',
        'INVALID_FILE_TYPE',
        400
      );
    }

    // Generate safe filename and filepath
    const filename = generateSafeFilename(file.name);
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Verify file was written successfully
    const stats = await getFileStats(filepath);
    if (!stats) {
      throw new FileUploadError(
        'File failed to write to disk',
        'WRITE_ERROR',
        500
      );
    }

    // Cleanup old files
    await cleanupOldFiles();

    // Create response with all headers
    const response = NextResponse.json({
      success: true,
      filename,
      url: `/uploads/${filename}`,
      size: stats.size,
      type: file.type
    });

    // Add security and CORS headers
    Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Upload error:', error);

    const statusCode = error instanceof FileUploadError ? error.statusCode : 500;
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      code: error instanceof FileUploadError ? error.code : 'UNKNOWN_ERROR',
    };

    const response = NextResponse.json(errorResponse, { status: statusCode });
    
    // Add headers even to error responses
    Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

// CORS preflight handler
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export const config = {
  api: {
    bodyParser: false, // Let Next.js handle body parsing
  },
};