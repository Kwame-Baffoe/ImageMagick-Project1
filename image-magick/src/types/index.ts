// src/types/index.ts

// Fixed JSON types without circular references
export type JsonPrimitive = string | number | boolean | null;

// Break circular references by using recursive types
export interface JsonMap {
  [key: string]: JsonPrimitive | JsonMap | JsonArray;
}

export interface JsonArray extends Array<JsonPrimitive | JsonMap | JsonArray> {}

// Now we can safely define our base types
export type JsonValue = JsonPrimitive | JsonMap | JsonArray;

// File related types
export interface FileWithPreview extends File {
  preview: string;
  uploadProgress?: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  id: string;
  metadata?: ImageMetadata;
}

// Type guard for checking valid JSON values
export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
};

// Image formats union type
export type ImageFormat = 'PNG' | 'JPG' | 'JPEG' | 'WEBP';

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  format: ImageFormat;
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
  processingTime: number;
  status: 'processing' | 'complete' | 'error';
  errorMessage?: string;
}

// Processing options with strict formats
export interface ProcessingOptions {
  inputFormat: ImageFormat;
  outputFormat: ImageFormat;
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
export interface ApiResponseBase {
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface ApiResponse<T> extends ApiResponseBase {
  data?: T;
}

export interface UploadResponseData {
  filename: string;
  url: string;
  metadata: ImageMetadata;
}

export interface ProcessingResponseData {
  processedUrl: string;
  metadata: ImageMetadata;
  processingTime: number;
}

export type UploadResponse = ApiResponse<UploadResponseData>;
export type ProcessingResponse = ApiResponse<ProcessingResponseData>;

// Error types
export interface ProcessingError {
  code: `ERR_${string}`;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// Type guard for processing errors
export const isProcessingError = (error: unknown): error is ProcessingError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ProcessingError).code === 'string' &&
    (error as ProcessingError).code.startsWith('ERR_') &&
    typeof (error as ProcessingError).message === 'string' &&
    'timestamp' in error &&
    typeof (error as ProcessingError).timestamp === 'number'
  );
};

// Configuration types
export interface ImageProcessingConfig {
  maxFileSize: number;
  maxFiles: number;
  acceptedTypes: Record<string, readonly string[]>;
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
    minLength: number;
  };
}

// Progress tracking
export interface ProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
}

// Event types
export type ProcessingEventType = 'progress' | 'complete' | 'error';

export interface ProcessingEventBase {
  type: ProcessingEventType;
  file: FileWithPreview;
  timestamp: number;
}

export interface ProcessingProgressEvent extends ProcessingEventBase {
  type: 'progress';
  progress: number;
}

export interface ProcessingCompleteEvent extends ProcessingEventBase {
  type: 'complete';
  result: ProcessedFile;
}

export interface ProcessingErrorEvent extends ProcessingEventBase {
  type: 'error';
  error: ProcessingError;
}

export type ProcessingEvent = 
  | ProcessingProgressEvent 
  | ProcessingCompleteEvent 
  | ProcessingErrorEvent;

// UI State
export interface ProcessingUIState {
  activeTab: 'upload' | 'options' | 'results';
  processing: boolean;
  progress: number;
  error: string | null;
  showConfirmDialog: boolean;
  lastUpdate: number;
}

// Validation
export interface ValidationRule {
  validate: (file: File) => Promise<boolean> | boolean;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Service types
export interface ImageService {
  upload: (file: File) => Promise<AsyncResult<UploadResponse>>;
  process: (file: FileWithPreview, options: ProcessingOptions) => Promise<AsyncResult<ProcessingResponse>>;
  cleanup: (file: FileWithPreview) => Promise<void>;
  retry: (file: FileWithPreview) => Promise<AsyncResult<ProcessingResponse>>;
}

// Queue types
export type QueueStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface QueueItem {
  file: FileWithPreview;
  options: ProcessingOptions;
  status: QueueStatus;
  priority: number;
  attempts: number;
  lastAttempt?: number;
}

export interface ProcessingQueue {
  add: (item: QueueItem) => void;
  remove: (fileId: string) => void;
  clear: () => void;
  getStatus: (fileId: string) => QueueStatus | undefined;
  getProgress: (fileId: string) => number;
  retry: (fileId: string) => void;
  getPending: () => QueueItem[];
}

// Storage types
export interface StorageOptions {
  prefix?: string;
  expires?: number;
  encrypt?: boolean;
}

export interface StorageData {
  value: JsonValue;
  timestamp: number;
  expires?: number;
  version: number;
}

export interface StorageService {
  save: <T extends JsonValue>(key: string, data: T, options?: StorageOptions) => Promise<void>;
  get: <T extends JsonValue>(key: string) => Promise<T | null>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  clearExpired: () => Promise<void>;
}

// Utility types
export type AsyncResult<T> = {
  data: T;
  error: null;
  timestamp: number;
} | {
  data: null;
  error: ProcessingError;
  timestamp: number;
};

// Helper types
export type Nullable<T> = T | null;

export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends Function
  ? T
  : T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};