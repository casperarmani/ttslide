import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { gemini, uploadFileToGemini } from '@/lib/google';
import { UploadedFile } from '@/lib/types';
import mime from 'mime-types';
import fs from 'fs';

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

    // To ensure we have some of each type for testing
    let faceCount = 0;
    let facelessCount = 0;
    let productCount = 0;

    for (const file of files) {
      // Determine folder type from relative path (webkitRelativePath)
      const relativePath = (file as any).webkitRelativePath || '';
      const folderName = relativePath.split('/')[0]?.toLowerCase() || '';

      let kind: 'face' | 'faceless' | 'product';

      // For development purposes, we'll distribute files evenly among the three types
      // to ensure we have at least one of each type
      if (folderName.includes('face') && !folderName.includes('faceless')) {
        // First set of files as face
        if (faceCount < files.length / 3) {
          kind = 'face';
          faceCount++;
        }
        // Second set as faceless
        else if (facelessCount < files.length / 3) {
          kind = 'faceless';
          facelessCount++;
        }
        // Rest as product
        else {
          kind = 'product';
          productCount++;
        }
      } else if (folderName.includes('faceless')) {
        kind = 'faceless';
        facelessCount++;
      } else if (folderName.includes('product')) {
        kind = 'product';
        productCount++;
      } else {
        // Distribute evenly if no specific folder name
        if (faceCount <= facelessCount && faceCount <= productCount) {
          kind = 'face';
          faceCount++;
        } else if (facelessCount <= productCount) {
          kind = 'faceless';
          facelessCount++;
        } else {
          kind = 'product';
          productCount++;
        }
      }
      
      // Get file buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Generate unique filename
      const fileExt = path.extname(file.name);
      const ext = fileExt.replace('.', '');
      const newFileName = `${kind}_${uuidv4()}${fileExt}`;
      const localFilePath = path.join(UPLOADS_DIR, newFileName);

      // Save file to uploads directory
      await writeFile(localFilePath, buffer);

      // Create local URL
      const localUrl = `/uploads/${newFileName}`;

      // Determine MIME type
      const mimeType = file.type || mime.lookup(ext) || 'application/octet-stream';

      // Upload the file to Gemini File API
      console.log(`Uploading file to Gemini File API: ${file.name} (${mimeType})`);
      const geminiFileResponse = await uploadFileToGemini(
        localFilePath,
        mimeType,
        file.name
      );

      console.log(`File processed for Gemini. Name: ${geminiFileResponse.name}`);

      // Add file to processed list
      processedFiles.push({
        kind,
        localUrl,
        geminiFileIdentifier: geminiFileResponse.name, // Store the Gemini file identifier
        geminiFileUri: geminiFileResponse.uri, // This might be undefined in mock mode
        mime: mimeType,
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