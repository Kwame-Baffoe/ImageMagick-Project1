// src/services/imageProcessing.ts
export interface ProcessedFile {
    original: string;
    processed: string;
    url: string;
    metadata: {
      width: number;
      height: number;
      size: number;
      format: string;
    };
  }
  
  export interface ImageRequirements {
    projectName: string;
    deadline: string;
    specifications: {
      targetPlatform: 'web' | 'mobile' | 'print' | 'social';
      colorProfile: 'RGB' | 'CMYK' | 'sRGB';
      quality: 'high' | 'medium' | 'low';
      optimizeFor: 'quality' | 'size';
    };
    customRequirements: string;
    deliveryFormat: {
      format: 'PNG' | 'JPG' | 'WebP';
      compression: number;
    };
    dimensions: {
      width: number;
      height: number;
      maintainAspectRatio: boolean;
    };
    processing: {
      colorCorrection: boolean;
      sharpen: boolean;
      noise: boolean;
      watermark: boolean;
      watermarkText?: string;
    };
  }
  
  export class ImageProcessingService {
    static async processImages(
      files: File[],
      requirements: ImageRequirements,
      onProgress?: (stage: string, progress: number) => void
    ): Promise<{ success: boolean; files: ProcessedFile[] }> {
      try {
        onProgress?.('Preparing files', 0);
  
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        formData.append('config', JSON.stringify({
          dimensions: {
            width: requirements.dimensions.width,
            height: requirements.dimensions.height,
            maintainAspectRatio: requirements.dimensions.maintainAspectRatio
          },
          colorProfile: requirements.specifications.colorProfile,
          outputFormat: requirements.deliveryFormat.format,
          quality: requirements.deliveryFormat.compression,
          colorCorrection: requirements.processing.colorCorrection,
          effects: {
            sharpen: requirements.processing.sharpen,
            noise: requirements.processing.noise
          },
          watermark: requirements.processing.watermark ? {
            enabled: true,
            text: requirements.processing.watermarkText,
            position: 'southeast',
            fontSize: 20,
            opacity: 70
          } : undefined
        }));
  
        const response = await fetch('/api/process', {
          method: 'POST',
          body: formData
        });
  
        if (!response.ok) {
          throw new Error(await response.text());
        }
  
        onProgress?.('Processing complete', 100);
  
        return await response.json();
      } catch (error) {
        console.error('Processing failed:', error);
        throw error;
      }
    }
  
    static validateRequirements(requirements: ImageRequirements): string[] {
      const errors: string[] = [];
  
      if (!requirements.projectName?.trim()) {
        errors.push('Project name is required');
      }
  
      if (!requirements.deadline) {
        errors.push('Deadline is required');
      }
  
      if (requirements.dimensions.width <= 0 || requirements.dimensions.height <= 0) {
        errors.push('Invalid dimensions specified');
      }
  
      if (requirements.processing.watermark && !requirements.processing.watermarkText?.trim()) {
        errors.push('Watermark text is required when watermark is enabled');
      }
  
      if (requirements.deliveryFormat.compression < 0 || requirements.deliveryFormat.compression > 100) {
        errors.push('Compression must be between 0 and 100');
      }
  
      return errors;
    }
  
    static getDefaultRequirements(): ImageRequirements {
      return {
        projectName: '',
        deadline: new Date().toISOString().split('T')[0],
        specifications: {
          targetPlatform: 'web',
          colorProfile: 'RGB',
          quality: 'high',
          optimizeFor: 'quality'
        },
        customRequirements: '',
        deliveryFormat: {
          format: 'PNG',
          compression: 80
        },
        dimensions: {
          width: 1920,
          height: 1080,
          maintainAspectRatio: true
        },
        processing: {
          colorCorrection: false,
          sharpen: false,
          noise: false,
          watermark: false,
          watermarkText: ''
        }
      };
    }
  }