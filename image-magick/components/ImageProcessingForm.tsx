// src/components/ImageProcessing.tsx
'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface FileWithPreview extends File {
  preview?: string;
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

interface ProcessedImage {
  original: string;
  processed: string;
  url: string;
}

export default function ImageProcessing() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);

  const [config, setConfig] = useState({
    inputFormat: 'PNG',
    outputFormat: 'JPG',
    resize: false,
    width: '',
    height: '',
    colorCorrection: false,
    batchProcessing: false,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setSuccess(false);

    const filesWithPreview = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );

    setFiles(filesWithPreview);

    if (filesWithPreview.length > 0) {
      try {
        const formData = new FormData();
        formData.append('image', filesWithPreview[0]);

        const response = await fetch('/api/metadata', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to extract metadata');

        const metadata = await response.json();
        setMetadata(metadata);
      } catch (err) {
        setError('Failed to extract image metadata');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: config.batchProcessing,
    maxSize: 10485760, // 10MB
  });

  const removeFile = (fileToRemove: FileWithPreview) => {
    setFiles(files => files.filter(file => file !== fileToRemove));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const handleProcess = async () => {
    setError(null);
    setSuccess(false);
    setProcessing(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      formData.append('config', JSON.stringify({
        inputFormat: config.inputFormat,
        outputFormat: config.outputFormat,
        resize: config.resize,
        dimensions: config.resize ? {
          width: parseInt(config.width),
          height: parseInt(config.height),
        } : undefined,
        colorCorrection: config.colorCorrection,
        batchProcessing: config.batchProcessing,
      }));

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Processing failed');
      }

      const result = await response.json();
      setProcessedImages(result.files);
      setSuccess(true);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process images');
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Image Processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
              ${error ? 'border-red-500' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive 
                ? 'Drop the files here...' 
                : 'Drag & drop images here, or click to select'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG up to 10MB {config.batchProcessing ? '(multiple files allowed)' : ''}
            </p>
          </div>

          {/* File Preview */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {file.preview ? (
                      <Image
                        src={file.preview}
                        alt={file.name}
                        width={48}
                        height={48}
                        className="rounded-md object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file)}
                    className="p-1 hover:bg-gray-200 rounded-full"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Processing Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Input Format</Label>
              <Select
                value={config.inputFormat}
                onValueChange={(value) => setConfig({ ...config, inputFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PNG">PNG</SelectItem>
                  <SelectItem value="JPG">JPG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={config.outputFormat}
                onValueChange={(value) => setConfig({ ...config, outputFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PNG">PNG</SelectItem>
                  <SelectItem value="JPG">JPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Processing Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="resize">Resize Images</Label>
              <Switch
                id="resize"
                checked={config.resize}
                onCheckedChange={(checked) => setConfig({ ...config, resize: checked })}
              />
            </div>

            {config.resize && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    value={config.width}
                    onChange={(e) => setConfig({ ...config, width: e.target.value })}
                    placeholder="Width"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    value={config.height}
                    onChange={(e) => setConfig({ ...config, height: e.target.value })}
                    placeholder="Height"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="colorCorrection">Color Correction</Label>
              <Switch
                id="colorCorrection"
                checked={config.colorCorrection}
                onCheckedChange={(checked) => setConfig({ ...config, colorCorrection: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="batchProcessing">Batch Processing</Label>
              <Switch
                id="batchProcessing"
                checked={config.batchProcessing}
                onCheckedChange={(checked) => setConfig({ ...config, batchProcessing: checked })}
              />
            </div>
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-gray-500">Processing images...</p>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>Images processed successfully!</AlertDescription>
            </Alert>
          )}

          {/* Processed Images */}
          {processedImages.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Processed Images</h3>
              <div className="grid grid-cols-2 gap-4">
                {processedImages.map((image, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <Image
                      src={image.url}
                      alt={`Processed ${index + 1}`}
                      width={200}
                      height={150}
                      className="rounded-lg object-cover"
                    />
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-sm text-gray-500">{image.original}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={image.url} download>Download</a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          <Button
            onClick={handleProcess}
            disabled={processing || files.length === 0}
            className="w-full"
          >
            {processing ? 'Processing...' : 'Process Images'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}