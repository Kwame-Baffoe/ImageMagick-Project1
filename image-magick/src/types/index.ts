// src/types/index.ts

// Base types for API data
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// File related types
export interface FileWithPreview extends File {
  preview: string;
  uploadProgress?: number;
  status?: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  id: string;
  metadata?: ImageMetadata;
}

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  format: string;
  lastModified: Date;
}

export interface ProcessedFile {
  id: string;
  originalName: string;
  processedName: string;
  originalUrl: string;
  processedUrl: string;
  metadata: ImageMetadata;
  processingOptions: ProcessingOptions;
  processingTime?: number;
  status: 'processing' | 'complete' | 'error';
  errorMessage?: string;
}

// Processing options and related types
export interface ProcessingOptions {
  inputFormat: string;
  outputFormat: string;
  quality: number;
  resize: boolean;
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  colorCorrection: boolean;
  sharpen: boolean;
  watermark: boolean;
  watermarkText: string;
  advancedFilters: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  processingNotes: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface UploadResponse extends ApiResponse<{
  filename: string;
  url: string;
  metadata: ImageMetadata;
}> {}

export interface ProcessingResponse extends ApiResponse<{
  processedUrl: string;
  metadata: ImageMetadata;
  processingTime: number;
}> {}

// Error types
export interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Configuration types
export interface ImageProcessingConfig {
  maxFileSize: number;
  maxFiles: number;
  acceptedTypes: Record<string, string[]>;
  dimensions: {
    max: number;
    min: number;
  };
  quality: {
    min: number;
    max: number;
    default: number;
  };
  watermark: {
    maxLength: number;
  };
}

// Progress tracking types
export interface ProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
}

// Event types
export interface ProcessingProgressEvent {
  type: 'progress';
  file: FileWithPreview;
  progress: number;
}

export interface ProcessingCompleteEvent {
  type: 'complete';
  file: FileWithPreview;
  result: ProcessedFile;
}

export interface ProcessingErrorEvent {
  type: 'error';
  file: FileWithPreview;
  error: ProcessingError;
}

export type ProcessingEvent = 
  | ProcessingProgressEvent 
  | ProcessingCompleteEvent 
  | ProcessingErrorEvent;

// UI State types
export interface ProcessingUIState {
  activeTab: 'upload' | 'options' | 'results';
  processing: boolean;
  progress: number;
  error: string | null;
  showConfirmDialog: boolean;
}

// Validation types
export interface ValidationRule {
  validate: (file: File) => Promise<boolean> | boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Service types
export interface ImageService {
  upload: (file: File) => Promise<UploadResponse>;
  process: (file: FileWithPreview, options: ProcessingOptions) => Promise<ProcessingResponse>;
  cleanup: (file: FileWithPreview) => Promise<void>;
}

// Queue types
export interface QueueItem {
  file: FileWithPreview;
  options: ProcessingOptions;
  status: 'pending' | 'processing' | 'complete' | 'error';
  priority: number;
}

export interface ProcessingQueue {
  add: (item: QueueItem) => void;
  remove: (fileId: string) => void;
  clear: () => void;
  getStatus: (fileId: string) => QueueItem['status'];
  getProgress: (fileId: string) => number;
}

// Storage types
export interface StorageOptions {
  prefix?: string;
  expires?: number;
}

export interface StorageData {
  value: JsonValue;
  timestamp: number;
  expires?: number;
}

export interface StorageService {
  save: (key: string, data: JsonValue, options?: StorageOptions) => Promise<void>;
  get: <T extends JsonValue>(key: string) => Promise<T | null>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

// Utility type to ensure type safety for async operations
export type AsyncResult<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: ProcessingError;
};

// Type guard functions
export const isProcessingError = (error: unknown): error is ProcessingError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ProcessingError).code === 'string' &&
    typeof (error as ProcessingError).message === 'string'
  );
};

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
};