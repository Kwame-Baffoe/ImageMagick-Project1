// src/app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessingConfig {
  dimensions?: {
    width: number;
    height: number;
  };
  colorCorrection?: boolean;
  outputFormat: string;
  watermark?: {
    enabled: boolean;
    text: string;
    position?: 'northwest' | 'north' | 'northeast' | 'west' | 'center' | 'east' | 'southwest' | 'south' | 'southeast';
    fontSize?: number;
    opacity?: number;
  };
  quality?: number;
  effects?: {
    sharpen?: boolean;
    blur?: boolean;
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
  cropOptions?: {
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotate?: number;
  flip?: 'horizontal' | 'vertical' | 'both';
  colorProfile?: 'RGB' | 'CMYK' | 'sRGB';
}

// Ensure upload and processed directories exist
const ensureDirectories = async () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const processedDir = path.join(process.cwd(), 'public', 'processed');
  
  await mkdir(uploadDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  
  return { uploadDir, processedDir };
};

// Build ImageMagick command with enhanced options
const buildImageMagickCommand = (inputPath: string, outputPath: string, config: ProcessingConfig): string => {
  let command = `convert "${inputPath}"`;

  // Color profile conversion
  if (config.colorProfile) {
    command += ` -colorspace ${config.colorProfile}`;
  }

  // Apply crop if enabled
  if (config.cropOptions?.enabled) {
    const { x, y, width, height } = config.cropOptions;
    command += ` -crop ${width}x${height}+${x}+${y}`;
  }

  // Apply resize if dimensions provided
  if (config.dimensions) {
    const resizeOption = config.cropOptions?.enabled ? '>' : '!';
    command += ` -resize ${config.dimensions.width}x${config.dimensions.height}${resizeOption}`;
  }

  // Rotation
  if (config.rotate) {
    command += ` -rotate ${config.rotate}`;
  }

  // Flipping
  if (config.flip) {
    switch (config.flip) {
      case 'horizontal':
        command += ' -flop';
        break;
      case 'vertical':
        command += ' -flip';
        break;
      case 'both':
        command += ' -flip -flop';
        break;
    }
  }

  // Color correction and effects
  if (config.colorCorrection) {
    command += ' -auto-level -normalize';
  }

  if (config.effects) {
    if (config.effects.sharpen) {
      command += ' -sharpen 0x1.0';
    }
    if (config.effects.blur) {
      command += ' -blur 0x1.0';
    }
    if (typeof config.effects.brightness === 'number') {
      command += ` -brightness-contrast ${config.effects.brightness}`;
    }
    if (typeof config.effects.contrast === 'number') {
      command += ` -contrast-stretch ${config.effects.contrast}%`;
    }
    if (typeof config.effects.saturation === 'number') {
      command += ` -modulate 100,${100 + config.effects.saturation}`;
    }
  }

  // Watermark
  if (config.watermark?.enabled && config.watermark.text) {
    const position = config.watermark.position || 'southeast';
    const fontSize = config.watermark.fontSize || 20;
    const opacity = config.watermark.opacity || 50;

    command += ` -gravity ${position}`;
    command += ` -pointsize ${fontSize}`;
    command += ` -fill white -fill rgba(255,255,255,${opacity/100})`;
    command += ` -annotate +10+10 "${config.watermark.text}"`;
  }

  // Quality
  if (config.quality) {
    command += ` -quality ${config.quality}`;
  }

  // Output
  command += ` "${outputPath}.${config.outputFormat.toLowerCase()}"`;

  return command;
};

// Get image metadata
const getImageMetadata = async (filePath: string) => {
  const { stdout } = await execAsync(`identify -format "%wx%h,%b,%m" "${filePath}"`);
  const [dimensions, size, format] = stdout.split(',');
  const [width, height] = dimensions.split('x').map(Number);

  return {
    width,
    height,
    size: parseInt(size),
    format
  };
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

      // Build and execute ImageMagick command
      const command = buildImageMagickCommand(uploadPath, outputPath, config);
      await execAsync(command);

      // Get metadata of processed image
      const metadata = await getImageMetadata(`${outputPath}.${config.outputFormat.toLowerCase()}`);

      // Clean up uploaded file
      await unlink(uploadPath);

      // Add to processed files list
      processedFiles.push({
        original: file.name,
        processed: `${outputFilename}.${config.outputFormat.toLowerCase()}`,
        url: `/processed/${outputFilename}.${config.outputFormat.toLowerCase()}`,
        metadata
      });
    }

    return NextResponse.json({
      success: true,
      files: processedFiles
    });
    
  } catch (error) {
    console.error('Image processing failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process images' },
      { status: 500 }
    );
  }
}