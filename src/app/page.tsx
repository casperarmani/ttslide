'use client';

import { useState } from 'react';
import { UploadedFile } from '@/lib/types';
import Link from 'next/link';
import { ArrowRight, Upload } from 'lucide-react';

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

  const handleFileChange = (type: 'face' | 'faceless' | 'product', event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    
    const fileList = Array.from(event.target.files);
    setFiles(prev => ({
      ...prev,
      [type]: fileList
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
      
      // Create FormData
      const formData = new FormData();
      
      // Append all files
      [...files.face, ...files.faceless, ...files.product].forEach(file => {
        formData.append('files', file);
      });
      
      // Call upload API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
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
          <div className="mt-4 flex justify-center gap-4">
            <Link href="/settings" className="text-blue-500 hover:underline flex items-center gap-1">
              Skip to Settings <ArrowRight size={14} />
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