import { NextRequest } from 'next/server';
import pLimit from 'p-limit';
import { BatchRequest, OrderResponse, Slideshow } from '@/lib/types';
import { deleteGeminiFile } from '@/lib/google';
import { defaultPrompts } from '@/lib/prompts';

// Create stream response for Server-Sent Events
function createSSEResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Store the controller for later use
      (globalThis as any).streamController = controller;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Send an event to the stream
function sendSSEEvent(event: string, data: any) {
  const controller = (globalThis as any).streamController;
  if (!controller) return;

  const encoder = new TextEncoder();
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

// Close the stream
function closeSSEStream() {
  const controller = (globalThis as any).streamController;
  if (!controller) return;
  
  controller.close();
  (globalThis as any).streamController = null;
}

export async function POST(request: NextRequest) {
  try {
    // Create stream response
    const response = createSSEResponse();

    console.log('POST /api/batch: Request received');

    // Parse request body
    const body: BatchRequest = await request.json();
    const {
      systemPrompt,
      researchMarkdown,
      captionPrompt,
      files,
      themes = defaultPrompts.themes,
      slideshowsPerTheme = defaultPrompts.slideshowsPerTheme,
      framesPerSlideshow = defaultPrompts.framesPerSlideshow
    } = body;

    console.log('POST /api/batch: Request parsed', {
      fileCount: files?.length || 0,
      themesCount: themes.length,
      slideshowsPerTheme,
      framesPerSlideshow
    });

    // 1. Start the process
    sendSSEEvent('status', {
      message: 'Starting batch processing',
      progress: 0
    });

    // 2. Call /api/order
    sendSSEEvent('status', {
      message: 'Ordering slideshows with Gemini',
      progress: 10
    });

    console.log('POST /api/batch: Sending files to order API:',
      (files || []).map(f => ({ kind: f.kind, id: f.geminiFileIdentifier })));

    const orderRes = await fetch(new URL('/api/order', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        files: files || [],
        themes,
        slideshowsPerTheme,
        framesPerSlideshow
      }),
    });
    
    if (!orderRes.ok) {
      const error = await orderRes.text();
      throw new Error(`Order API failed: ${error}`);
    }
    
    const orderData: OrderResponse = await orderRes.json();
    
    sendSSEEvent('status', { 
      message: 'Successfully ordered slideshows', 
      progress: 30 
    });
    
    // 3. Parallel caption calls with rate limiting
    sendSSEEvent('status', { 
      message: 'Generating captions with Claude', 
      progress: 40 
    });
    
    // Use p-limit to limit concurrency to 3 calls (reduced from 5)
    // This helps prevent rate limit issues with Claude API
    const limit = pLimit(3);

    const captionPromises = orderData.slideshows.map((slide, index) => {
      return limit(async () => {
        // Report progress for each caption call
        sendSSEEvent('status', {
          message: `Generating captions for slideshow ${index + 1}/${orderData.slideshows.length}`,
          progress: 40 + Math.floor((index / orderData.slideshows.length) * 50)
        });

        // Add a small delay between calls to avoid rate limits
        // The actual backoff for API rate limits is now handled in generateCaptions
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const captionRes = await fetch(new URL('/api/caption', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            slide,
            research: researchMarkdown,
            systemPrompt: captionPrompt
          }),
        });
        
        if (!captionRes.ok) {
          const error = await captionRes.text();
          throw new Error(`Caption API failed for slideshow ${index + 1}: ${error}`);
        }
        
        const captionData = await captionRes.json();
        
        return {
          theme: slide.theme,
          images: slide.images,
          captions: captionData.captions,
        };
      });
    });
    
    // Wait for all caption calls to complete
    const slideshows: Slideshow[] = await Promise.all(captionPromises);
    
    // 4. Clean up Gemini files (optional step)
    sendSSEEvent('status', {
      message: 'Cleaning up temporary files',
      progress: 95
    });

    // Delete files from Gemini File API
    try {
      // Process files in batches to avoid rate limits
      const cleanupLimit = pLimit(5);
      const cleanupPromises = (files || []).map(file =>
        cleanupLimit(async () => {
          try {
            await deleteGeminiFile(file.geminiFileIdentifier);
            console.log(`Successfully deleted Gemini file: ${file.geminiFileIdentifier}`);
          } catch (cleanupError) {
            console.warn(`Warning: Failed to delete Gemini file ${file.geminiFileIdentifier}:`, cleanupError);
            // We don't throw here to avoid failing the entire process over cleanup
          }
        })
      );

      // Wait for all cleanups to complete
      await Promise.all(cleanupPromises);
      console.log('File cleanup complete');
    } catch (cleanupError) {
      console.warn('Warning: Some files may not have been cleaned up:', cleanupError);
      // We continue despite cleanup errors
    }

    // 5. Complete the process
    sendSSEEvent('status', {
      message: 'Batch processing complete',
      progress: 100
    });

    // Send final data
    sendSSEEvent('complete', {
      slideshows
    });

    // Close the stream
    closeSSEStream();
    
    return response;
    
  } catch (error) {
    console.error('Error in batch API:', error);
    
    // Send error event
    sendSSEEvent('error', { 
      message: `Error: ${(error as any).message || 'Unknown error'}` 
    });
    
    // Close the stream
    closeSSEStream();
    
    return new Response(JSON.stringify({ error: 'Failed to process batch request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}