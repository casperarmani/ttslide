import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Verify the file type is an image
        const isImage = /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(pathname);
        if (!isImage) {
          throw new Error('Only image files are allowed');
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'image/bmp'
          ],
          tokenPayload: JSON.stringify({
            // Add any metadata you want to pass to onUploadCompleted
            pathname
          }),
          addRandomSuffix: true, // Add random suffix on the server side
          cacheControlMaxAge: 31536000, // Cache for 1 year (in seconds)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          // Log the successful upload
          console.log('Blob upload completed:', blob);
          // Parse any payload sent from onBeforeGenerateToken
          if (tokenPayload) {
            const payload = JSON.parse(tokenPayload);
            console.log('Upload payload:', payload);
          }
        } catch (error) {
          console.error("Error in onUploadCompleted:", error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Error in handleUpload:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}