// src/lib/types/requirements.ts
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