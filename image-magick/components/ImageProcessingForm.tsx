'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Check, 
  AlertCircle,
  Loader2,
  Download
} from 'lucide-react';
import Image from 'next/image';
import { ImageRequirements } from '@/lib/types/requirements';
import { ImageProcessingService, ProcessedFile } from '../src/services/imageProcessing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface FileWithPreview extends File {
  preview: string;
}

export default function ImageProcessingForm() {
  const [activeTab, setActiveTab] = useState('requirements');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [requirements, setRequirements] = useState<ImageRequirements>(
    ImageProcessingService.getDefaultRequirements()
  );
  
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    setFiles(prev => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: 10485760, // 10MB
    multiple: true
  });

  const removeFile = useCallback((fileToRemove: FileWithPreview) => {
    setFiles(files => files.filter(file => file !== fileToRemove));
    URL.revokeObjectURL(fileToRemove.preview);
  }, []);

  const handleRequirementsSubmit = async () => {
    const errors = await ImageProcessingService.validateRequirements(requirements);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (files.length === 0) {
      setValidationErrors(['Please upload at least one image']);
      return;
    }
    setValidationErrors([]);
    setShowConfirmDialog(true);
  };

  const handleProcessing = async () => {
    setShowConfirmDialog(false);
    setProcessing(true);
    setError(null);
    setProgress(0);
    setActiveTab('processing');

    try {
      const result = await ImageProcessingService.processImages(
        files,
        requirements,
        (currentStage, currentProgress) => {
          setStage(currentStage);
          setProgress(currentProgress);
        }
      );

      setProcessedFiles(result.files);
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Advanced Image Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="requirements">
              <div className="space-y-6">
                {/* File Upload Section */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Upload Images</Label>
                  <div
                    {...getRootProps()}
                    className={`
                      border-2 border-dashed rounded-lg p-6 text-center transition-colors
                      ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                    `}
                  >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      {isDragActive
                        ? 'Drop the files here...'
                        : 'Drag & drop images here, or click to select'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 10MB
                    </p>
                  </div>

                  {/* File Preview */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <Image
                              src={file.preview}
                              alt={file.name}
                              width={48}
                              height={48}
                              className="rounded-md object-cover"
                            />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Project Details */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Project Details</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        value={requirements.projectName}
                        onChange={(e) => setRequirements({
                          ...requirements,
                          projectName: e.target.value
                        })}
                        placeholder="Enter project name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={requirements.deadline}
                        onChange={(e) => setRequirements({
                          ...requirements,
                          deadline: e.target.value
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Image Specifications */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Image Specifications</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target Platform</Label>
                      <Select
                        value={requirements.specifications.targetPlatform}
                        onValueChange={(value: 'web' | 'mobile' | 'print' | 'social') =>
                          setRequirements({
                            ...requirements,
                            specifications: {
                              ...requirements.specifications,
                              targetPlatform: value
                            }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="web">Web</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="print">Print</SelectItem>
                          <SelectItem value="social">Social Media</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Color Profile</Label>
                      <Select
                        value={requirements.specifications.colorProfile}
                        onValueChange={(value: 'RGB' | 'CMYK' | 'sRGB') =>
                          setRequirements({
                            ...requirements,
                            specifications: {
                              ...requirements.specifications,
                              colorProfile: value
                            }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RGB">RGB</SelectItem>
                          <SelectItem value="CMYK">CMYK</SelectItem>
                          <SelectItem value="sRGB">sRGB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Processing Options */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Processing Options</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={requirements.processing.colorCorrection}
                        onCheckedChange={(checked) =>
                          setRequirements({
                            ...requirements,
                            processing: {
                              ...requirements.processing,
                              colorCorrection: checked
                            }
                          })
                        }
                      />
                      <Label>Color Correction</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={requirements.processing.sharpen}
                        onCheckedChange={(checked) =>
                          setRequirements({
                            ...requirements,
                            processing: {
                              ...requirements.processing,
                              sharpen: checked
                            }
                          })
                        }
                      />
                      <Label>Sharpen</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={requirements.processing.watermark}
                        onCheckedChange={(checked) =>
                          setRequirements({
                            ...requirements,
                            processing: {
                              ...requirements.processing,
                              watermark: checked
                            }
                          })
                        }
                      />
                      <Label>Watermark</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={requirements.processing.noise}
                        onCheckedChange={(checked) =>
                          setRequirements({
                            ...requirements,
                            processing: {
                              ...requirements.processing,
                              noise: checked
                            }
                          })
                        }
                      />
                      <Label>Noise Reduction</Label>
                    </div>
                  </div>

                  {requirements.processing.watermark && (
                    <div className="space-y-2">
                      <Label>Watermark Text</Label>
                      <Input
                        value={requirements.processing.watermarkText}
                        onChange={(e) =>
                          setRequirements({
                            ...requirements,
                            processing: {
                              ...requirements.processing,
                              watermarkText: e.target.value
                            }
                          })
                        }
                        placeholder="Enter watermark text"
                      />
                    </div>
                  )}
                </div>

                {/* Custom Requirements */}
                <div className="space-y-2">
                  <Label>Additional Requirements</Label>
                  <Textarea
                    value={requirements.customRequirements}
                    onChange={(e) =>
                      setRequirements({
                        ...requirements,
                        customRequirements: e.target.value
                      })
                    }
                    placeholder="Any additional requirements or special instructions..."
                    className="h-32"
                  />
                </div>

                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validation Error</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleRequirementsSubmit}
                  className="w-full"
                  disabled={files.length === 0}
                >
                  Continue to Processing
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="processing">
              <div className="space-y-4 p-6 text-center">
                {processing ? (
                  <div className="space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <div>
                      <p className="text-lg font-medium">{stage}</p>
                      <Progress value={progress} className="w-full mt-2" />
                    </div>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button onClick={() => setActiveTab('requirements')}>
                      Back to Requirements
                    </Button>
                  </div>
                ) : (
                  <p>Ready to process images</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="results">
              <div className="space-y-6 p-6">
                {processedFiles.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Processed Images</h3>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFiles([]);
                          setProcessedFiles([]);
                          setRequirements(ImageProcessingService.getDefaultRequirements());
                          setActiveTab('requirements');
                        }}
                      >
                        Process New Images
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {processedFiles.map((file, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="relative aspect-video mb-4">
                              <Image
                                src={file.url}
                                alt={file.original}
                                fill
                                className="object-cover rounded-lg"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{file.original}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = file.url;
                                    link.download = file.processed;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                              <div className="text-sm text-gray-500 space-y-1">
                                <p>Dimensions: {file.metadata.width}x{file.metadata.height}px</p>
                                <p>Format: {file.metadata.format}</p>
                                <p>Size: {(file.metadata.size / 1024).toFixed(2)} KB</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Processing Summary</h4>
                      <div className="text-sm text-gray-600">
                        <p>Total Images: {processedFiles.length}</p>
                        <p>Output Format: {requirements.deliveryFormat.format}</p>
                        <p>Color Profile: {requirements.specifications.colorProfile}</p>
                        {requirements.processing.watermark && (
                          <p>Watermark Applied: Yes</p>
                        )}
                        <p>Processing Options Applied:</p>
                        <ul className="list-disc ml-4">
                          {requirements.processing.colorCorrection && (
                            <li>Color Correction</li>
                          )}
                          {requirements.processing.sharpen && (
                            <li>Image Sharpening</li>
                          )}
                          {requirements.processing.noise && (
                            <li>Noise Reduction</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No processed images yet</p>
                    <Button
                      onClick={() => setActiveTab('requirements')}
                      className="mt-4"
                    >
                      Back to Requirements
                    </Button>
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
            <AlertDialogDescription className="space-y-2">
              <p>Please confirm the following processing requirements:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Project: {requirements.projectName}</li>
                <li>Target Platform: {requirements.specifications.targetPlatform}</li>
                <li>Color Profile: {requirements.specifications.colorProfile}</li>
                <li>Files to Process: {files.length}</li>
                {requirements.processing.watermark && (
                  <li>Watermark Text: {requirements.processing.watermarkText}</li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessing}>
              Process Images
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}