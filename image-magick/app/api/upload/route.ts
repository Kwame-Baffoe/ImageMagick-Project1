// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, stat } from 'fs/promises';
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

// Utility functions
const validateFileType = (file: File): boolean => {
  const extension = path.extname(file.name).toLowerCase();
  return ALLOWED_TYPES.has(file.type) && ALLOWED_EXTENSIONS.has(extension);
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
  return `${uniqueId}-${baseFilename}${extension}`;
};

const getFileStats = async (filepath: string) => {
  try {
    return await stat(filepath);
  } catch (error) {
    console.error('Error getting file stats:', error);
    return null;
  }
};

// Main upload handler
export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Ensure upload directory exists
    await ensureUploadDirectory();

    const data = await req.formData();
    const file = data.get('file');

    // Validate file exists and is a File object
    if (!file || !(file instanceof File)) {
      return NextResponse.json({
        success: false,
        error: 'No file provided or invalid file format'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }, { status: 400 });
    }

    // Validate file type
    if (!validateFileType(file)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP files are allowed.'
      }, { status: 400 });
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
      throw new Error('File failed to write to disk');
    }

    // Return success response
    return NextResponse.json({
      success: true,
      filename,
      url: `/uploads/${filename}`,
      size: stats.size,
      type: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// CORS handler
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// API configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
};