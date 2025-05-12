'use client';

import { useState } from 'react';
import { UploadedFile, BlobUploadDetail } from '@/lib/types';
import Link from 'next/link';
import { ArrowRight, History, Upload } from 'lucide-react';
import { upload } from '@vercel/blob/client';

export default function Home() {
  const [files, setFiles] = useState<{
    face: File[],
    faceless: File[],
    product: File[]
  }>({
    face: [],
    faceless: [],
    product: []
  });

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filteredInfo, setFilteredInfo] = useState<{
    face: number,
    faceless: number,
    product: number
  }>({
    face: 0,
    faceless: 0,
    product: 0
  });

  const handleFileChange = (type: 'face' | 'faceless' | 'product', event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) {
      setFiles(prev => ({ ...prev, [type]: [] })); // Clear if no files selected
      return;
    }

    const rawFileList = Array.from(event.target.files);

    // Define accepted image MIME types
    const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp'];

    const filteredFileList = rawFileList.filter(file => {
      // Check for accepted MIME types
      const isAcceptedType = acceptedImageTypes.includes(file.type);
      const isHiddenFile = file.name.startsWith('.');

      // Fallback: Check file extension if MIME type is missing or generic
      let isAcceptedByExtension = false;
      if (!isAcceptedType || file.type === '' || file.type === 'application/octet-stream') {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'];
        isAcceptedByExtension = imageExtensions.includes(extension);
      }

      // Log the filtering decision
      if (!isAcceptedType && !isAcceptedByExtension) {
        console.warn(`Filtering out file: '${file.name}' due to unsupported format: '${file.type}'`);
      }
      if (isHiddenFile) {
        console.warn(`Filtering out hidden file: '${file.name}'`);
      }

      return (isAcceptedType || isAcceptedByExtension) && !isHiddenFile;
    });

    if (rawFileList.length !== filteredFileList.length) {
      const skippedCount = rawFileList.length - filteredFileList.length;
      console.log(`${skippedCount} file(s) were filtered out from the selection for '${type}' category.`);

      // Update filtered info state
      setFilteredInfo(prev => ({
        ...prev,
        [type]: skippedCount
      }));
    } else {
      // Reset filtered info for this type if no files were filtered
      setFilteredInfo(prev => ({
        ...prev,
        [type]: 0
      }));
    }

    setFiles(prev => ({
      ...prev,
      [type]: filteredFileList
    }));
  };

  const handleUpload = async () => {
    try {
      setUploading(true);
      setError(null);

      // Check if we have files in each category
      if (!files.face.length || !files.faceless.length || !files.product.length) {
        setError('Please upload files for all three categories.');
        setUploading(false);
        return;
      }

      // Keep track of uploaded blobs before sending to the API
      const uploadedBlobs: BlobUploadDetail[] = [];

      // Upload face files to Blob storage
      for (const file of files.face) {
        try {
          const blob = await upload(`face/${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/blob/handle-upload',
          });

          uploadedBlobs.push({
            kind: 'face',
            blobUrl: blob.url,
            mime: file.type || 'image/jpeg',
            originalName: file.name
          });
        } catch (error) {
          console.error("Blob upload error for face image:", error);
          setError(`Upload failed for ${file.name}: ${(error as Error).message}`);
          setUploading(false);
          return;
        }
      }

      // Upload faceless files to Blob storage
      for (const file of files.faceless) {
        try {
          const blob = await upload(`faceless/${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/blob/handle-upload',
          });

          uploadedBlobs.push({
            kind: 'faceless',
            blobUrl: blob.url,
            mime: file.type || 'image/jpeg',
            originalName: file.name
          });
        } catch (error) {
          console.error("Blob upload error for faceless image:", error);
          setError(`Upload failed for ${file.name}: ${(error as Error).message}`);
          setUploading(false);
          return;
        }
      }

      // Upload product files to Blob storage
      for (const file of files.product) {
        try {
          const blob = await upload(`product/${file.name}`, file, {
            access: 'public',
            handleUploadUrl: '/api/blob/handle-upload',
          });

          uploadedBlobs.push({
            kind: 'product',
            blobUrl: blob.url,
            mime: file.type || 'image/jpeg',
            originalName: file.name
          });
        } catch (error) {
          console.error("Blob upload error for product image:", error);
          setError(`Upload failed for ${file.name}: ${(error as Error).message}`);
          setUploading(false);
          return;
        }
      }

      // All uploads successful, now register with Gemini via process-uploads API
      const response = await fetch('/api/process-uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadedBlobs)
      });

      if (!response.ok) {
        throw new Error(`Processing uploaded files failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadedFiles(data);

      // Save uploaded files to localStorage for use on other pages
      localStorage.setItem('uploadedFiles', JSON.stringify(data));

      // Redirect to settings page
      window.location.href = '/settings';

    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">TikTok Slide Generator</h1>
      </header>
      
      <main className="flex-1 container mx-auto p-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload Images</h2>
          
          <div className="grid gap-6 md:grid-cols-3">
            <FileUploadBox 
              label="Face Images"
              description="People shots that grab attention"
              accept="image/*"
              onChange={(e) => handleFileChange('face', e)}
              files={files.face}
            />
            
            <FileUploadBox 
              label="Faceless Images"
              description="Non-face visuals for twist & outcome"
              accept="image/*"
              onChange={(e) => handleFileChange('faceless', e)}
              files={files.faceless}
            />
            
            <FileUploadBox 
              label="Product Images"
              description="Branded images for call-to-action"
              accept="image/*"
              onChange={(e) => handleFileChange('product', e)}
              files={files.product}
            />
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Display filtered files information */}
          {Object.values(filteredInfo).some(count => count > 0) && (
            <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 rounded text-sm">
              <p className="font-medium">Some non-image files were automatically filtered out:</p>
              <ul className="mt-1 list-disc list-inside">
                {filteredInfo.face > 0 && (
                  <li>{filteredInfo.face} non-image file(s) skipped from Face Images</li>
                )}
                {filteredInfo.faceless > 0 && (
                  <li>{filteredInfo.faceless} non-image file(s) skipped from Faceless Images</li>
                )}
                {filteredInfo.product > 0 && (
                  <li>{filteredInfo.product} non-image file(s) skipped from Product Images</li>
                )}
              </ul>
              <p className="mt-1">Only supported image formats are included.</p>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-black text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                'Uploading...'
              ) : (
                <>
                  <Upload size={18} />
                  Upload & Continue
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="text-center text-gray-500 text-sm">
          <p>Images will be uploaded to the server for processing. Each slideshow follows a 4-frame narrative.</p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/settings" className="text-blue-500 hover:underline flex items-center gap-1">
              Skip to Settings <ArrowRight size={14} />
            </Link>
            <Link href="/history" className="text-blue-500 hover:underline flex items-center gap-1">
              View History <History size={14} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function FileUploadBox({
  label,
  description,
  accept,
  onChange,
  files
}: {
  label: string;
  description: string;
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  files: File[];
}) {
  return (
    <div className="border rounded-lg p-4 flex flex-col items-center text-center">
      <h3 className="font-medium mb-2">{label}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      
      <label className="cursor-pointer bg-gray-50 hover:bg-gray-100 border border-dashed rounded-lg w-full p-4 flex flex-col items-center justify-center">
        <Upload size={24} className="text-gray-400 mb-2" />
        <span className="text-sm text-gray-700">Drag files or click to browse</span>
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          className="hidden"
          // @ts-ignore webkitdirectory is a non-standard attribute
          webkitdirectory="true"
          multiple
        />
      </label>
      
      {files.length > 0 && (
        <div className="mt-3 text-sm text-gray-600">
          {files.length} file{files.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}