import { NextRequest, NextResponse } from 'next/server';
import { invokeGeminiWithTool, createFilePartFromFileAPI } from '@/lib/google';
import { slideshowsSchema, defaultPrompts } from '@/lib/prompts';
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
    promptParts.push(GText("\n\nI have uploaded images that I want to organize into TikTok slideshows. For each image below, I am providing its unique Gemini File API Identifier and its kind. You MUST use these Gemini File API Identifiers when specifying images in your JSON output.\n"));

    // Add face images
    promptParts.push(GText(`\nFace images (${filesByType.face.length}):\n`));
    filesByType.face.forEach(file => {
      try {
        // Add the actual image visual content when possible
        if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
          promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
        } else {
          // Fallback for mock mode or missing URI
          promptParts.push(GText(`[Image visual not available]`));
        }
        // Always provide the Gemini File identifier prominently and explicitly
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Even on error, still provide the identifier reference
        promptParts.push(GText(`[Image visual not available]`));
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      }
    });

    // Add faceless images
    promptParts.push(GText(`\nFaceless images (${filesByType.faceless.length}):\n`));
    filesByType.faceless.forEach(file => {
      try {
        // Add the actual image visual content when possible
        if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
          promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
        } else {
          // Fallback for mock mode or missing URI
          promptParts.push(GText(`[Image visual not available]`));
        }
        // Always provide the Gemini File identifier prominently and explicitly
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Even on error, still provide the identifier reference
        promptParts.push(GText(`[Image visual not available]`));
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      }
    });

    // Add product images
    promptParts.push(GText(`\nProduct images (${filesByType.product.length}):\n`));
    filesByType.product.forEach(file => {
      try {
        // Add the actual image visual content when possible
        if (file.geminiFileUri && (file.geminiFileUri.startsWith('https://') || file.geminiFileUri.startsWith('gs://'))) {
          promptParts.push(createFilePartFromFileAPI(file.mime, file.geminiFileUri));
        } else {
          // Fallback for mock mode or missing URI
          promptParts.push(GText(`[Image visual not available]`));
        }
        // Always provide the Gemini File identifier prominently and explicitly
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      } catch (error) {
        console.warn(`Failed to process file ${file.originalName}:`, error);
        // Even on error, still provide the identifier reference
        promptParts.push(GText(`[Image visual not available]`));
        promptParts.push(GText(`Gemini File API Identifier: ${file.geminiFileIdentifier}, Kind: ${file.kind}\n`));
      }
    });

    // Add the task instructions with original ordering prompt and specific format requirements
    const originalOrderingSystemPrompt = defaultPrompts.ordering;

    promptParts.push(GText(`
${originalOrderingSystemPrompt}

Your primary task, as outlined in the creative brief above, is to generate a slideshow plan.
For this specific interaction, you MUST structure your final output EXCLUSIVELY as a single JSON object.
It is CRITICAL that you invoke the 'create_slideshow_plan' tool to generate this JSON.

The JSON object MUST strictly adhere to the following schema:
The top-level key of this JSON object MUST be "slideshows".
The "slideshows" key must contain an array of slideshow objects.
Each slideshow object in the array represents a single slideshow and MUST contain:
a. "theme": A string for the theme (e.g., one of ${JSON.stringify(themes)}).
b. "images": An array of exactly ${framesPerSlideshow} image identifiers.

---------------------------------------------------
CRITICALLY IMPORTANT FOR IMAGE IDENTIFIERS IN THE "images" ARRAY:
---------------------------------------------------

BEFORE GENERATING YOUR RESPONSE, RE-READ THIS SECTION CAREFULLY:

The image identifiers you use in the "images" array MUST be the EXACT Gemini File API Identifiers I provided above for each image.
Each valid identifier follows this format: "files/xxxxxxxxxxxx" (for example, "files/fcdtzh17l0eq" or "files/mzt9t3vm9ue4").

DO NOT use any other reference format. ONLY use the string specified after "Gemini File API Identifier:" for each image.

For example, if I described an image as:
   [Image visual]
   Gemini File API Identifier: files/abc123def456, Kind: face

Then in your JSON response, you must use EXACTLY "files/abc123def456" as the identifier in the images array.

INCORRECT: "testface/image.jpg", "/uploads/image.jpg", or any other format
CORRECT: "files/abc123def456" (the exact Gemini File API Identifier)

---------------------------------------------------

Review your generated plan carefully. After designing the slideshows according to the creative brief, ensure your entire response is ONLY the described JSON object, formatted correctly, and uses only the correct Gemini File API identifiers.

Please generate ${slideshowsPerTheme} slideshows for each of the specified themes: ${themes.join(', ')}.
This means a total of ${themes.length * slideshowsPerTheme} slideshows.
Each slideshow must contain exactly ${framesPerSlideshow} images.
The sequence of images within each slideshow, based on the image types provided (face, faceless, product), MUST be:
Hook/Pain: A face image.
Twist: A faceless image.
Dream Outcome: Another faceless image.
Product Call-out: A product image.

BEFORE FINALIZING YOUR RESPONSE: Check each identifier in your "images" arrays and ensure they all exactly match the Gemini File API Identifiers provided above.
`));

    // Call Gemini with the tool schema and multimodal parts
    console.log('POST /api/order: Calling Gemini with multimodal prompt (parts count: ' + promptParts.length + ')');
    // For debugging, uncomment to log the last part of the prompt
    // console.log('POST /api/order: Last prompt part:', JSON.stringify(promptParts.slice(-1), null, 2));

    let geminiResult;
    try {
      geminiResult = await invokeGeminiWithTool(
        promptParts,
        slideshowsSchema,
        'create_slideshow_plan'
      );
      // Log the raw result for debugging
      console.log('POST /api/order: Raw result from invokeGeminiWithTool:',
        typeof geminiResult === 'string' ? geminiResult.substring(0, 1000) + "..." : JSON.stringify(geminiResult, null, 2).substring(0, 1000) + "...");
    } catch (geminiError) {
      console.error('POST /api/order: Error during invokeGeminiWithTool call:', geminiError);
      return NextResponse.json(
        { error: `Gemini API call via invokeGeminiWithTool failed: ${(geminiError as Error).message}` },
        { status: 500 }
      );
    }

    // Check if Gemini's response is valid
    if (!geminiResult || typeof geminiResult !== 'object') {
      console.error('POST /api/order: Parsed Gemini result is invalid. Actual parsed result:', JSON.stringify(geminiResult, null, 2));
      return NextResponse.json(
        { error: 'Gemini response was invalid or did not adhere to the expected schema.' },
        { status: 500 }
      );
    }

    // Handle the case where the response has a different structure with themed_slideshows
    let slideshows = [];
    if (geminiResult.themed_slideshows && Array.isArray(geminiResult.themed_slideshows)) {
      console.log('POST /api/order: Found themed_slideshows structure in response.');
      // Extract slideshows from themed_slideshows structure
      slideshows = geminiResult.themed_slideshows.flatMap(themeGroup => {
        if (themeGroup.slideshows && Array.isArray(themeGroup.slideshows)) {
          return themeGroup.slideshows.map(slide => ({
            theme: themeGroup.theme_name || themeGroup.theme,
            images: slide.image_ids || slide.images || []
          }));
        }
        return [];
      });
    } else if (geminiResult.slideshows && Array.isArray(geminiResult.slideshows)) {
      // Existing structure (preferred)
      slideshows = geminiResult.slideshows;
    } else {
      console.error('POST /api/order: Gemini result does not contain valid slideshows structure:', geminiResult);
      return NextResponse.json(
        { error: 'Gemini response was invalid or did not contain a recognizable slideshows structure.' },
        { status: 500 }
      );
    }

    if (slideshows.length === 0) {
      console.error('POST /api/order: No slideshows found in Gemini response.');
      return NextResponse.json(
        { error: 'No slideshows found in Gemini response.' },
        { status: 500 }
      );
    }

    // Create a mapping from Gemini file identifiers to local URLs
    const identifierToUrlMap = Object.fromEntries(
      files.map(file => [file.geminiFileIdentifier, file.localUrl])
    );

    // Process the slideshows with enhanced validation
    const processedSlideshows = slideshows.map((slideshow, index) => {
      if (!slideshow || typeof slideshow !== 'object' || !slideshow.images || !Array.isArray(slideshow.images)) {
        console.warn(`POST /api/order: Slideshow at index ${index} is malformed or missing images array:`, slideshow);
        return { theme: slideshow?.theme || "unknown", images: [], error: "Malformed slideshow data from Gemini" };
      }

      const mappedImages = slideshow.images.map((identifier, imgIndex) => {
        if (typeof identifier !== 'string') {
          console.warn(`POST /api/order: Invalid image identifier format received at index ${imgIndex} in slideshow ${index}:`, identifier);
          return `invalid_identifier:${JSON.stringify(identifier)}`;
        }

        const url = identifierToUrlMap[identifier];
        if (!url) {
          // Check if this looks like a Gemini file ID
          if (identifier.startsWith('files/')) {
            console.warn(`POST /api/order: Could not find local URL for Gemini identifier: "${identifier}" in slideshow ${index}.`);
          } else {
            console.warn(`POST /api/order: Invalid Gemini image identifier format: "${identifier}" in slideshow ${index}. Expected "files/xxxx".`);
          }
          return identifier; // Return the original identifier as fallback
        }
        return url;
      });

      return {
        theme: slideshow.theme,
        images: mappedImages
      };
    });

    // Filter out slideshows with errors if needed
    const validProcessedSlideshows = processedSlideshows.filter(s => !s.error && s.images.length === framesPerSlideshow);
    if (validProcessedSlideshows.length !== processedSlideshows.length) {
      console.warn(`POST /api/order: ${processedSlideshows.length - validProcessedSlideshows.length} slideshows were filtered out due to validation issues.`);
    }

    console.log(`POST /api/order: Successfully processed ${validProcessedSlideshows.length} slideshows out of ${processedSlideshows.length} received from Gemini.`);
    return NextResponse.json({ slideshows: validProcessedSlideshows });

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