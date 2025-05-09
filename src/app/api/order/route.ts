import { NextRequest, NextResponse } from 'next/server';
import { invokeGeminiWithTool } from '@/lib/google';
import { slideshowsSchema } from '@/lib/prompts';
import { OrderRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: OrderRequest = await request.json();
    const { systemPrompt, files } = body;
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Build user prompt
    const filesByType = {
      face: files.filter(file => file.kind === 'face'),
      faceless: files.filter(file => file.kind === 'faceless'),
      product: files.filter(file => file.kind === 'product')
    };
    
    // Create a prompt for Gemini that explains the task and file details
    const userPrompt = `
${systemPrompt}

I have uploaded images that I want to organize into TikTok slideshows. Here are the files:

Face images (${filesByType.face.length}):
${filesByType.face.map(f => `- File ID: ${f.geminiId}, Type: ${f.mime}`).join('\n')}

Faceless images (${filesByType.faceless.length}):
${filesByType.faceless.map(f => `- File ID: ${f.geminiId}, Type: ${f.mime}`).join('\n')}

Product images (${filesByType.product.length}):
${filesByType.product.map(f => `- File ID: ${f.geminiId}, Type: ${f.mime}`).join('\n')}

Create 30 slideshows (10 per theme) where each slideshow follows this sequence:
1. Hook/Pain: A face image that grabs attention
2. Twist: A faceless image that amplifies the pain
3. Dream Outcome: Another faceless image that shows relief
4. Product Call-out: A product image that finishes the story

Return a JSON object with slideshows organized by theme, using the file IDs provided.
`;

    // Call Gemini with the tool schema
    const result = await invokeGeminiWithTool(
      userPrompt,
      slideshowsSchema,
      'create_slideshow_plan'
    );

    // Create a mapping from Gemini file IDs to local URLs
    const idToUrlMap = Object.fromEntries(
      files.map(file => [file.geminiId, file.localUrl])
    );

    // Replace Gemini file IDs with local URLs in the response
    const processedSlideshows = result.slideshows.map(slideshow => ({
      theme: slideshow.theme,
      images: slideshow.images.map(id => idToUrlMap[id] || id)
    }));

    return NextResponse.json({ slideshows: processedSlideshows });
    
  } catch (error) {
    console.error('Error in ordering API:', error);
    return NextResponse.json(
      { error: 'Failed to process order request' },
      { status: 500 }
    );
  }
}