import { NextRequest } from 'next/server';
import pLimit from 'p-limit';
import { BatchRequest, OrderResponse, Slideshow } from '@/lib/types';

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
    
    // Parse request body
    const body: BatchRequest = await request.json();
    const { systemPrompt, researchMarkdown, captionPrompt, files } = body;
    
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

    console.log('Batch API: Sending files to order API:',
      (files || []).map(f => ({ kind: f.kind, id: f.geminiId })));

    const orderRes = await fetch(new URL('/api/order', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        files: files || [] // Use the files passed from the frontend
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
    
    // Use p-limit to limit concurrency to 5 calls
    const limit = pLimit(5);
    
    const captionPromises = orderData.slideshows.map((slide, index) => {
      return limit(async () => {
        // Report progress for each caption call
        sendSSEEvent('status', { 
          message: `Generating captions for slideshow ${index + 1}/30`, 
          progress: 40 + Math.floor((index / 30) * 50) 
        });
        
        // Add a small delay between calls to avoid rate limits
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
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
    
    // 4. Complete the process
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