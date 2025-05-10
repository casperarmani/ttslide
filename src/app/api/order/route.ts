import { NextRequest, NextResponse } from 'next/server';
import { invokeGeminiWithTool, createFilePartFromFileAPI } from '@/lib/google';
import { slideshowsSchema } from '@/lib/prompts';
import { OrderRequest } from '@/lib/types';
import { Part } from '@google/genai';

export async function POST(request: NextRequest) {
  console.log('POST /api/order: Request received.');
  try {
    // Parse request body
    const body: OrderRequest = await request.json();
    console.log('POST /api/order: Request body parsed:', {
      systemPromptLength: body.systemPrompt?.length || 0,
      fileCount: body.files?.length || 0,
      themes: body.themes || ['PMS', 'Insomnia', 'Anxiety'],
      slideshowsPerTheme: body.slideshowsPerTheme || 10,
      framesPerSlideshow: body.framesPerSlideshow || 4
    });

    const {
      systemPrompt,
      files,
      themes = ['PMS', 'Insomnia', 'Anxiety'],
      slideshowsPerTheme = 10,
      framesPerSlideshow = 4
    } = body;

    if (!files || files.length === 0) {
      console.warn('POST /api/order: No files provided.');
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Check if there's at least one image of each type
    const hasAllTypes =
      files.some(file => file.kind === 'face') &&
      files.some(file => file.kind === 'faceless') &&
      files.some(file => file.kind === 'product');

    if (!hasAllTypes) {
      console.warn('POST /api/order: Missing image types.');
      return NextResponse.json(
        { error: 'Need at least one image of each type (face, faceless, product)' },
        { status: 400 }
      );
    }

    console.log('POST /api/order: Processing with user-defined values:', {
      themesCount: themes.length,
      slideshowsPerTheme
    });

    // Build user prompt parts for multimodal input
    const filesByType = {
      face: files.filter(file => file.kind === 'face'),
      faceless: files.filter(file => file.kind === 'faceless'),
      product: files.filter(file => file.kind === 'product')
    };

    console.log('POST /api/order: Files by type counts:', {
      face: filesByType.face.length,
      faceless: filesByType.faceless.length,
      product: filesByType.product.length
    });

    // Helper functions to create text parts
    const GText = (text: string): Part => ({ text: text });

    // Create the multimodal prompt parts array
    const promptParts: Part[] = [];

    // Start with the system prompt
    promptParts.push(GText(systemPrompt));
    promptParts.push(GText("\n\nI have uploaded images that I want to organize into TikTok slideshows. Here are the files:\n"));

    // Add face images with visual content (or mockups in development)
    promptParts.push(GText(`\nFace images (${filesByType.face.length}):`));
    filesByType.face.forEach(file => {
      try {
        // Check if we're in mock mode or if file references are valid
        if (!file.geminiFileUri || (!file.geminiFileUri.startsWith('https://') && !file.geminiFileUri.startsWith('gs://'))) {
          // Mock mode - use text references instead
          promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
        } else {
          // Real mode with valid Gemini file references
          if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
            promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
          } else {
            // Fallback if we don't have a URI
            promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          }
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}\n`));
        }
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Fallback to text reference
        promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
        promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
      }
    });

    // Add faceless images with visual content (or mockups)
    promptParts.push(GText(`\nFaceless images (${filesByType.faceless.length}):`));
    filesByType.faceless.forEach(file => {
      try {
        // Check if we're in mock mode or if file references are valid
        if (!file.geminiFileUri || (!file.geminiFileUri.startsWith('https://') && !file.geminiFileUri.startsWith('gs://'))) {
          // Mock mode - use text references instead
          promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
        } else {
          // Real mode with valid Gemini file references
          if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
            promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
          } else {
            // Fallback if we don't have a URI
            promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          }
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}\n`));
        }
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Fallback to text reference
        promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
        promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
      }
    });

    // Add product images with visual content (or mockups)
    promptParts.push(GText(`\nProduct images (${filesByType.product.length}):`));
    filesByType.product.forEach(file => {
      try {
        // Check if we're in mock mode or if file references are valid
        if (!file.geminiFileUri || (!file.geminiFileUri.startsWith('https://') && !file.geminiFileUri.startsWith('gs://'))) {
          // Mock mode - use text references instead
          promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
        } else {
          // Real mode with valid Gemini file references
          if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
            promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
          } else {
            // Fallback if we don't have a URI
            promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
          }
          promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}\n`));
        }
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Fallback to text reference
        promptParts.push(GText(`[Image Reference: ${file.geminiFileIdentifier}]`));
        promptParts.push(GText(`Name: ${file.originalName || 'unnamed'}, Type: ${file.kind}\n`));
      }
    });

    // Add the task instructions
    promptParts.push(GText(`
Generate ${slideshowsPerTheme} slideshows for each of the following themes: ${themes.join(', ')}.
Total slideshows to generate: ${themes.length * slideshowsPerTheme}.

Each slideshow must have exactly ${framesPerSlideshow} images and follow this sequence:
1. Hook/Pain: A face image that grabs attention
2. Twist: A faceless image that amplifies the pain
3. Dream Outcome: Another faceless image that shows relief
4. Product Call-out: A product image that finishes the story

Return a JSON object using the 'create_slideshow_plan' tool, containing the slideshows organized by theme, using the file identifiers provided.
Ensure the output strictly adheres to the provided tool schema.
`));

    // Call Gemini with the tool schema and multimodal parts
    console.log('POST /api/order: Calling Gemini with multimodal prompt (parts count: ' + promptParts.length + ')');

    let geminiResult;
    try {
      geminiResult = await invokeGeminiWithTool(
        promptParts,
        slideshowsSchema,
        'create_slideshow_plan'
      );
      console.log('POST /api/order: Gemini response received successfully:',
        JSON.stringify(geminiResult, null, 2).substring(0, 500) + "..."); // Log snippet
    } catch (geminiError) {
      console.error('POST /api/order: Error during invokeGeminiWithTool:', geminiError);
      throw geminiError; // Re-throw to be caught by the outer try-catch
    }

    if (!geminiResult || !geminiResult.slideshows) {
      console.error('POST /api/order: Gemini result is invalid or missing slideshows property.', geminiResult);
      throw new Error('Gemini response was invalid or did not contain slideshows.');
    }

    // Create a mapping from Gemini file identifiers to local URLs
    const identifierToUrlMap = Object.fromEntries(
      files.map(file => [file.geminiFileIdentifier, file.localUrl])
    );

    // Replace Gemini file identifiers with local URLs in the response
    const processedSlideshows = geminiResult.slideshows.map(slideshow => ({
      theme: slideshow.theme,
      images: slideshow.images.map(identifier => identifierToUrlMap[identifier] || identifier)
    }));

    console.log('POST /api/order: Successfully processed slideshows. Count:', processedSlideshows.length);
    return NextResponse.json({ slideshows: processedSlideshows });

  } catch (error) {
    console.error('POST /api/order: Error in main catch block.', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to process order request. ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}