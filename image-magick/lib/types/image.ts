// src/lib/types/image.ts
export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    size: number;
  }
  
  export interface ProcessingConfig {
    inputFormat: 'PNG' | 'JPG';
    outputFormat: 'PNG' | 'JPG';
    resize: boolean;
    dimensions?: {
      width: number;
      height: number;
    };
    colorCorrection: boolean;
    batchProcessing: boolean;
  }
  
  export interface ProcessedImage {
    original: string;
    processed: string;
    url: string;
  }