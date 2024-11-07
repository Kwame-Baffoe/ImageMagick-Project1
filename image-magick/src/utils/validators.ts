// src/utils/validators.ts
import sharp from 'sharp';
import { ProcessingError } from './errorHandlers';

export const validateImage = async (buffer: Buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new ProcessingError(
        'Invalid image dimensions',
        'INVALID_DIMENSIONS',
        400
      );
    }

    if (metadata.width > 8000 || metadata.height > 8000) {
      throw new ProcessingError(
        'Image dimensions too large',
        'DIMENSIONS_TOO_LARGE',
        400
      );
    }

    return metadata;
  } catch (error) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      'Failed to validate image',
      'VALIDATION_FAILED',
      400,
    //   error
      
    );
  }
};