// src/app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Ensure upload and processed directories exist
const ensureDirectories = async () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const processedDir = path.join(process.cwd(), 'public', 'processed');
  
  await mkdir(uploadDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  
  return { uploadDir, processedDir };
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const config = JSON.parse(formData.get('config') as string);
    
    if (!files.length) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const { uploadDir, processedDir } = await ensureDirectories();
    const processedFiles = [];

    for (const file of files) {
      // Save uploaded file temporarily
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uniquePrefix = Date.now() + '-' + Math.random().toString(36).substring(2);
      const uploadFilename = `${uniquePrefix}-${file.name}`;
      const uploadPath = path.join(uploadDir, uploadFilename);
      await writeFile(uploadPath, buffer);

      // Prepare output filename and path
      const outputFilename = `processed-${uniquePrefix}-${file.name}`;
      const outputPath = path.join(processedDir, outputFilename);

      // Build ImageMagick command
      let command = `convert "${uploadPath}"`;

      if (config.resize && config.dimensions) {
        command += ` -resize ${config.dimensions.width}x${config.dimensions.height}!`;
      }

      if (config.colorCorrection) {
        command += ` -auto-level -normalize`;
      }

      // Set output format
      const outputFormat = config.outputFormat.toLowerCase();
      command += ` "${outputPath}.${outputFormat}"`;

      // Process image
      await execAsync(command);

      // Clean up uploaded file
      await unlink(uploadPath);

      // Add to processed files list
      processedFiles.push({
        original: file.name,
        processed: `${outputFilename}.${outputFormat}`,
        url: `/processed/${outputFilename}.${outputFormat}`
      });
    }

    return NextResponse.json({
      success: true,
      files: processedFiles
    });
    
  } catch (error) {
    console.error('Image processing failed:', error);
    return NextResponse.json(
      { error: 'Failed to process images' },
      { status: 500 }
    );
  }
}