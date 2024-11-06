// src/app/page.tsx
import ImageProcessing from "../components/ImageProcessingForm";

export default function ImageProcessingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Image Processing Tool</h1>
          <p className="mt-2 text-gray-600">Upload, transform, and optimize your images</p>
        </div>
        <ImageProcessing />
      </div>
    </div>
  );
}