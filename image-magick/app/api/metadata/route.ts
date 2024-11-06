// src/app/api/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises'; // Import unlink here
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    const filepath = path.join(uploadDir, file.name);
    await writeFile(filepath, buffer);

    // Get metadata using ImageMagick
    const { stdout } = await execAsync(`identify -format "%w %h %m %b" ${filepath}`);
    const [width, height, format, size] = stdout.split(' ');

    // Clean up temporary file
    await unlink(filepath); // Use the imported unlink function

    return NextResponse.json({
      width: parseInt(width),
      height: parseInt(height),
      format,
      size: parseInt(size)
    });
    
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    return NextResponse.json(
      { error: 'Failed to extract metadata' },
      { status: 500 }
    );
  }
}