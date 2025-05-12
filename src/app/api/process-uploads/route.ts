import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToGeminiFromUrl } from '@/lib/google';
import { BlobUploadDetail, UploadedFile } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body containing blob file details
    const uploadedBlobs: BlobUploadDetail[] = await request.json();

    // Check if we have any files
    if (!uploadedBlobs || uploadedBlobs.length === 0) {
      return NextResponse.json(
        { error: 'No uploaded files provided' },
        { status: 400 }
      );
    }

    // Process each blob and register with Gemini
    const processedFiles: UploadedFile[] = [];

    for (const blob of uploadedBlobs) {
      try {
        console.log(`Processing Blob URL for Gemini: ${blob.originalName} (${blob.mime}) as ${blob.kind}`);
        
        // Register with Gemini File API
        const geminiFileResponse = await uploadFileToGeminiFromUrl(
          blob.blobUrl,
          blob.mime,
          blob.originalName
        );

        console.log(`File processed for Gemini. Name: ${geminiFileResponse.name}`);

        // Add file to processed list
        processedFiles.push({
          kind: blob.kind,
          blobUrl: blob.blobUrl,
          geminiFileIdentifier: geminiFileResponse.name,
          geminiFileUri: geminiFileResponse.uri,
          mime: blob.mime,
          originalName: blob.originalName
        });
      } catch (blobError) {
        console.error(`Error processing blob ${blob.originalName}:`, blobError);
        // Continue with other blobs even if one fails
      }
    }

    // Check if we were able to process any files
    if (processedFiles.length === 0) {
      return NextResponse.json(
        { error: 'Failed to process any of the uploaded files' },
        { status: 500 }
      );
    }

    // Return the processed files
    return NextResponse.json(processedFiles);
    
  } catch (error) {
    console.error('Error processing uploads:', error);
    return NextResponse.json(
      { error: 'Failed to process uploads' },
      { status: 500 }
    );
  }
}