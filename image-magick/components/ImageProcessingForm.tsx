'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { 
  Upload, 
  X, 
  Check, 
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  Filter,
  Settings,
  ImageIcon,

} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Type Definitions
interface FileWithPreview extends File {
  id: string;
  preview: string;
  status: 'uploading' | 'complete' | 'error' | 'processing';
  uploadProgress?: number;
  error?: string;
  metadata?: ImageMetadata;
}

interface ProcessedFile {
  id: string;
  originalName: string;
  processedName: string;
  originalUrl: string;
  processedUrl: string;
  metadata: ImageMetadata;
  processingTime: number;
  status: 'complete' | 'error';
  error?: string;
}

interface ProcessingOptions {
  outputFormat: 'PNG' | 'JPG' | 'WebP';
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

interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  format: string;
  lastModified: Date;
}

interface FileErrorAlertProps {
  filename: string;
  onRetry: () => Promise<void>;
  onRemove: () => void;
}

// Constants
const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

const defaultProcessingOptions: ProcessingOptions = {
  outputFormat: 'PNG',
  quality: 80,
  resize: false,
  width: 1920,
  height: 1080,
  maintainAspectRatio: true,
  colorCorrection: false,
  sharpen: false,
  watermark: false,
  watermarkText: '',
  advancedFilters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
  },
  processingNotes: '',
};

// Utility Functions
const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const createImageElement = (): HTMLImageElement => {
  return document.createElement('img');
};


const extractMetadata = async (file: File): Promise<ImageMetadata> => {
  return new Promise((resolve, reject) => {
    const img = createImageElement();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: img.width,
        height: img.height,
        size: file.size,
        format: file.type.split('/')[1].toUpperCase(),
        lastModified: new Date(file.lastModified)
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image metadata'));
    };

    img.src = objectUrl;
  });
};


// Error Alert Component
const FileErrorAlert: React.FC<FileErrorAlertProps> = ({ filename, onRetry, onRemove }) => (
  <Alert variant="destructive" className="mt-2">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Upload Failed</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>Failed to upload {filename}</span>
      <div className="space-x-2">
        <Button variant="outline" size="sm" onClick={() => onRetry()}>
          Retry
        </Button>
        <Button variant="outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

// Main Component
const ImageProcessingForm: React.FC = () => {
  // State Management
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [options, setOptions] = useState<ProcessingOptions>(defaultProcessingOptions);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup Effect
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [files]);

  // File Upload Handler
  const handleFileUpload = useCallback(async (file: FileWithPreview): Promise<void> => {
    try {
      if (!file) {
        throw new Error('No file selected');
      }

      const formData = new FormData();
      formData.append('file', file);

      const metadata = await extractMetadata(file);
      formData.append('metadata', JSON.stringify(metadata));

      setFiles((prevFiles) => 
        prevFiles.map((f): FileWithPreview => 
          f.id === file.id
            ? {
                ...f,
                status: 'uploading',
                uploadProgress: 0,
                metadata
              }
            : f
        )
      );

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      setFiles((prevFiles) =>
        prevFiles.map((f): FileWithPreview =>
          f.id === file.id
            ? {
                ...f,
                status: 'complete',
                uploadProgress: 100,
                preview: data.url,
                metadata: data.metadata || metadata
              }
            : f
        )
      );

      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully`,
        duration: 3000,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Upload error:', error);
      
      setFiles((prevFiles) =>
        prevFiles.map((f): FileWithPreview =>
          f.id === file.id
            ? {
                ...f,
                status: 'error',
                error: errorMessage
              }
            : f
        )
      );

      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: errorMessage,
        duration: 5000,
      });

      throw error;
    }
  }, [toast]);

  // File Removal Handler
  const removeFile = useCallback((fileToRemove: FileWithPreview) => {
    setFiles((prevFiles) => prevFiles.filter(file => file.id !== fileToRemove.id));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  }, []);

  // Process Handler
  const handleProcess = useCallback(async () => {
    setProcessing(true);
    setProgress(0);
    setUploadError(null);
    
    try {
      const totalFiles = files.length;
      const processed: ProcessedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const startTime = Date.now();

        setFiles((prevFiles) =>
          prevFiles.map((f): FileWithPreview =>
            f.id === file.id
              ? { ...f, status: 'processing' }
              : f
          )
        );

        const formData = new FormData();
        formData.append('file', file);
        formData.append('options', JSON.stringify(options));

        const response = await fetch('/api/process', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Processing failed');
        }

        const data = await response.json();
        const processingTime = Date.now() - startTime;

        const processedFile: ProcessedFile = {
          id: file.id,
          originalName: file.name,
          processedName: data.processedUrl.split('/').pop()!,
          originalUrl: file.preview,
          processedUrl: data.processedUrl,
          metadata: data.metadata,
          processingTime,
          status: 'complete'
        };

        processed.push(processedFile);
        setProcessedFiles((prev) => [...prev, processedFile]);
        setProgress(((i + 1) / totalFiles) * 100);
      }

      toast({
        title: "Processing Complete",
        description: `Successfully processed ${totalFiles} image${totalFiles > 1 ? 's' : ''}`,
        duration: 5000,
      });

      setActiveTab('results');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error('Processing error:', error);
      setUploadError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setProcessing(false);
    }
  }, [files, options, toast]);

  // Reset Filters Handler
  const resetAdvancedFilters = useCallback(() => {
    setOptions(prev => ({
      ...prev,
      advancedFilters: defaultProcessingOptions.advancedFilters
    }));
    
    toast({
      title: "Filters Reset",
      description: "Advanced filters have been reset to default values",
      duration: 3000,
    });
  }, [toast]);

  // Dropzone Handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > MAX_FILES) {
      toast({
        variant: "destructive",
        title: "Too Many Files",
        description: `Maximum ${MAX_FILES} files allowed`,
        duration: 5000,
      });
      return;
    }

    const newFiles: FileWithPreview[] = acceptedFiles.map(file => ({
      ...file,
      preview: URL.createObjectURL(file),
      id: generateUniqueId(),
      status: 'uploading',
      uploadProgress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (const file of newFiles) {
      try {
        await handleFileUpload(file);
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
  }, [files.length, handleFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true
  });

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="bg-white shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>Image Processing Station</span>
              {processing && (
                <span className="text-sm text-gray-500">
                  - Processing Step {Math.floor(progress / 25) + 1}/4
                </span>
              )}
            </div>
            {processing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center text-sm text-blue-600"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </motion.div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload">
              <div className="space-y-6">
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-8",
                    "transition-all duration-200 ease-in-out",
                    isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300",
                    "hover:border-blue-400 hover:bg-blue-50/50"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center space-y-4">
                    <motion.div
                      animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Upload className="h-12 w-12 text-gray-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-base text-gray-600">
                        {isDragActive ? 'Drop your images here' : 'Drag & drop your images here'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Supports: PNG, JPG, WebP up to {formatFileSize(MAX_FILE_SIZE)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Uploaded Files List */}
                <AnimatePresence>
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="relative border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="relative h-20 w-20 rounded-md overflow-hidden">
                          <Image
                            src={file.preview}
                            alt={`Preview of ${file.name}`}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium truncate">{file.name}</p>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(file)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Upload Progress */}
                          {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                            <div className="mt-2 space-y-1">
                              <Progress value={file.uploadProgress} className="h-1" />
                              <p className="text-xs text-gray-500">
                                Uploading... {file.uploadProgress}%
                              </p>
                            </div>
                          )}

                          {/* Success Status */}
                          {file.status === 'complete' && (
                            <p className="text-xs text-green-500 mt-2 flex items-center">
                              <Check className="h-3 w-3 mr-1" />
                              Ready for processing
                            </p>
                          )}

                          {/* Error Status */}
                          {file.status === 'error' && (
                            <FileErrorAlert
                              filename={file.name}
                              onRetry={async () => {
                                await handleFileUpload(file);
                              }}
                              onRemove={() => removeFile(file)}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Continue Button */}
                {files.length > 0 && (
                  <Button
                    className="w-full"
                    onClick={() => setActiveTab('options')}
                    disabled={files.some(f => f.status === 'uploading')}
                  >
                    Continue to Options
                    <Settings className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Options Tab */}
            <TabsContent value="options">
              <div className="space-y-6">
                {/* Basic Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Output Format</Label>
                    <Select
                      value={options.outputFormat}
                      onValueChange={(value: 'PNG' | 'JPG' | 'WebP') => 
                        setOptions(prev => ({ ...prev, outputFormat: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PNG">PNG</SelectItem>
                        <SelectItem value="JPG">JPG</SelectItem>
                        <SelectItem value="WebP">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quality ({options.quality}%)</Label>
                    <Slider
                      value={[options.quality]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([value]) => 
                        setOptions(prev => ({ ...prev, quality: value }))
                      }
                    />
                  </div>
                </div>

                {/* Resize Options */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="resize">Resize Images</Label>
                    <Switch
                      id="resize"
                      checked={options.resize}
                      onCheckedChange={(checked) => 
                        setOptions(prev => ({ ...prev, resize: checked }))
                      }
                    />
                  </div>

                  {options.resize && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Width (px)</Label>
                        <Input
                          type="number"
                          value={options.width}
                          onChange={(e) => 
                            setOptions(prev => ({ 
                              ...prev, 
                              width: parseInt(e.target.value) || prev.width 
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height (px)</Label>
                        <Input
                          type="number"
                          value={options.height}
                          onChange={(e) => 
                            setOptions(prev => ({ 
                              ...prev, 
                              height: parseInt(e.target.value) || prev.height 
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label htmlFor="aspectRatio">Maintain Aspect Ratio</Label>
                    <Switch
                      id="aspectRatio"
                      checked={options.maintainAspectRatio}
                      onCheckedChange={(checked) => 
                        setOptions(prev => ({ 
                          ...prev, 
                          maintainAspectRatio: checked 
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Enhancement Options */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="colorCorrection">Color Correction</Label>
                    <Switch
                      id="colorCorrection"
                      checked={options.colorCorrection}
                      onCheckedChange={(checked) => 
                        setOptions(prev => ({ 
                          ...prev, 
                          colorCorrection: checked 
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sharpen">Sharpen</Label>
                    <Switch
                      id="sharpen"
                      checked={options.sharpen}
                      onCheckedChange={(checked) => 
                        setOptions(prev => ({ 
                          ...prev, 
                          sharpen: checked 
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="watermark">Add Watermark</Label>
                    <Switch
                      id="watermark"
                      checked={options.watermark}
                      onCheckedChange={(checked) => 
                        setOptions(prev => ({ 
                          ...prev, 
                          watermark: checked 
                        }))
                      }
                    />
                  </div>

                  {options.watermark && (
                    <div className="space-y-2">
                      <Label>Watermark Text</Label>
                      <Input
                        value={options.watermarkText}
                        onChange={(e) => 
                          setOptions(prev => ({ 
                            ...prev, 
                            watermarkText: e.target.value 
                          }))
                        }
                        placeholder="Enter watermark text"
                      />
                    </div>
                  )}
                </div>

                {/* Advanced Filters */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Label>Advanced Filters</Label>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetAdvancedFilters}
                            className="h-8 w-8 p-0"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reset all filters</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-6">
                    {/* Brightness */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Brightness</Label>
                        <span className="text-sm text-gray-500">
                          {options.advancedFilters.brightness > 0 ? '+' : ''}
                          {options.advancedFilters.brightness}
                        </span>
                      </div>
                      <Slider
                        value={[options.advancedFilters.brightness]}
                        min={-100}
                        max={100}
                        step={1}
                        onValueChange={([value]) => 
                          setOptions(prev => ({
                            ...prev,
                            advancedFilters: {
                              ...prev.advancedFilters,
                              brightness: value
                            }
                          }))
                        }
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Contrast</Label>
                        <span className="text-sm text-gray-500">
                          {options.advancedFilters.contrast > 0 ? '+' : ''}
                          {options.advancedFilters.contrast}
                        </span>
                      </div>
                      <Slider
                        value={[options.advancedFilters.contrast]}
                        min={-100}
                        max={100}
                        step={1}
                        onValueChange={([value]) => 
                          setOptions(prev => ({
                            ...prev,
                            advancedFilters: {
                              ...prev.advancedFilters,
                              contrast: value
                            }
                          }))
                        }
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Saturation</Label>
                        <span className="text-sm text-gray-500">
                          {options.advancedFilters.saturation > 0 ? '+' : ''}
                          {options.advancedFilters.saturation}
                        </span>
                      </div>
                      <Slider
                        value={[options.advancedFilters.saturation]}
                        min={-100}
                        max={100}
                        step={1}
                        onValueChange={([value]) => 
                          setOptions(prev => ({
                            ...prev,
                            advancedFilters: {
                              ...prev.advancedFilters,
                              saturation: value
                            }
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Processing Notes */}
                <div className="space-y-2">
                  <Label>Processing Notes</Label>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border border-gray-300 p-2"
                    value={options.processingNotes}
                    onChange={(e) => 
                      setOptions(prev => ({
                        ...prev,
                        processingNotes: e.target.value
                      }))
                    }
                    placeholder="Add any special instructions or notes..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('upload')}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Back to Upload
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={files.length === 0}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Process Images
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results">
              <div className="space-y-6">
                {processing ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-12 w-12 text-blue-500" />
                    </motion.div>
                    <Progress value={progress} className="w-64 mt-4" />
                    <p className="mt-4 text-sm text-gray-500">
                      Processing your images... {Math.round(progress)}%
                    </p>
                  </div>
                ) : processedFiles.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      {processedFiles.map((file, index) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="relative group"
                        >
                          <Card>
                            <CardContent className="p-4">
                              <div className="relative aspect-video mb-4 overflow-hidden rounded-lg">
                                <Image
                                  src={file.processedUrl}
                                  alt={`Processed version of ${file.originalName}`}
                                  fill
                                  className="object-cover transition-transform group-hover:scale-105"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium truncate">{file.originalName}</p>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = file.processedUrl;
                                            link.download = file.processedName;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Download processed image</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  <p>Size: {formatFileSize(file.metadata.size)}</p>
                                  <p>Dimensions: {file.metadata.width}x{file.metadata.height}px</p>
                                  <p>Format: {file.metadata.format}</p>
                                  <p>Processing Time: {(file.processingTime / 1000).toFixed(2)}s</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFiles([]);
                          setProcessedFiles([]);
                          setOptions(defaultProcessingOptions);
                          setActiveTab('upload');
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Process New Images
                      </Button>
                      <Button
                        onClick={() => {
                          processedFiles.forEach(file => {
                            const link = document.createElement('a');
                            link.href = file.processedUrl;
                            link.download = file.processedName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          });
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download All
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-12">
                    <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-4 text-gray-500">No processed images yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Processing</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>You are about to process {files.length} image{files.length !== 1 ? 's' : ''} with the following settings:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Output Format: {options.outputFormat}</li>
                  <li>Quality: {options.quality}%</li>
                  {options.resize && (
                    <li>
                      Resize to: {options.width}x{options.height}px
                      {options.maintainAspectRatio ? ' (maintaining aspect ratio)' : ''}
                    </li>
                  )}
                  {options.colorCorrection && <li>Color Correction: Enabled</li>}
                  {options.sharpen && <li>Sharpening: Enabled</li>}
                  {options.watermark && <li>Watermark: `{options.watermarkText}`</li>}
                  {Object.entries(options.advancedFilters).some(([_, value]) => value !== 0) && (
                    <li>
                      Advanced Filters: 
                      {Object.entries(options.advancedFilters)
                        .filter(([_, value]) => value !== 0)
                        .map(([key, value]) => ` ${key} (${value > 0 ? '+' : ''}${value})`)
                        .join(', ')}
                    </li>
                  )}
                  {options.processingNotes && (
                    <li>Processing Notes: `{options.processingNotes}`</li>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmDialog(false);
              handleProcess();
              setActiveTab('results');
            }}>
              Process Images
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Notifications */}
      <AnimatePresence>
        {files.map((file) => (
          file.status === 'complete' && (
            <motion.div
              key={`success-${file.id}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed bottom-4 right-4 z-50"
            >
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  {file.name} has been uploaded successfully
                </AlertDescription>
              </Alert>
            </motion.div>
          )
        ))}
      </AnimatePresence>

      {/* Error Notifications */}
      {uploadError && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </div>
  );
};

export type {
  FileWithPreview,
  ProcessedFile,
  ProcessingOptions,
  ImageMetadata,
  FileErrorAlertProps,
};

export default ImageProcessingForm;