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

    // Get files by category from the frontend
    const faceFiles = formData.getAll('faceFiles') as File[];
    const facelessFiles = formData.getAll('facelessFiles') as File[];
    const productFiles = formData.getAll('productFiles') as File[];

    // Check if we have files in at least one category
    if ((faceFiles.length + facelessFiles.length + productFiles.length) === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    // Process each file
    const processedFiles: UploadedFile[] = [];

    // Process files by category with helper function
    const processFilesByCategory = async (files: File[], kind: 'face' | 'faceless' | 'product') => {
      for (const file of files) {
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
        console.log(`Uploading file to Gemini File API: ${file.name} (${mimeType}) as ${kind}`);
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
    };

    // Process all files by their respective categories
    await processFilesByCategory(faceFiles, 'face');
    await processFilesByCategory(facelessFiles, 'faceless');
    await processFilesByCategory(productFiles, 'product');

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