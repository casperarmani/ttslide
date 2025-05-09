import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { gemini } from '@/lib/google';
import { UploadedFile } from '@/lib/types';

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(process.cwd(), 'public/uploads');

// Process a multipart/form-data request with files
export async function POST(request: NextRequest) {
  try {
    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true });
    
    // Parse the multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    // Process each file
    const processedFiles: UploadedFile[] = [];
    
    for (const file of files) {
      // Determine folder type from relative path (webkitRelativePath)
      const relativePath = (file as any).webkitRelativePath || '';
      const folderName = relativePath.split('/')[0]?.toLowerCase() || '';
      
      let kind: 'face' | 'faceless' | 'product';
      
      if (folderName.includes('face') && !folderName.includes('faceless')) {
        kind = 'face';
      } else if (folderName.includes('faceless')) {
        kind = 'faceless';
      } else if (folderName.includes('product')) {
        kind = 'product';
      } else {
        // Default if folder can't be determined
        kind = relativePath.includes('product') ? 'product' : 
               relativePath.includes('faceless') ? 'faceless' : 'face';
      }
      
      // Generate unique filename
      const fileExt = path.extname(file.name);
      const newFileName = `${kind}_${uuidv4()}${fileExt}`;
      const localFilePath = path.join(UPLOADS_DIR, newFileName);
      
      // Save file to uploads directory
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(localFilePath, buffer);
      
      // Create local URL
      const localUrl = `/uploads/${newFileName}`;

      // Upload file to Gemini
      const result = await gemini.files.createFromBlob({
        data: buffer,
        mimeType: file.type
      });
      
      // Add file to processed list
      processedFiles.push({
        kind,
        localUrl,
        geminiId: result.fileId,
        mime: file.type,
        originalName: file.name
      });
    }

    // Return the processed files
    return NextResponse.json(processedFiles);
    
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}