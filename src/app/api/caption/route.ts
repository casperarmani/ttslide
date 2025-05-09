import { NextRequest, NextResponse } from 'next/server';
import { generateCaptions } from '@/lib/anthropic';
import { CaptionRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CaptionRequest = await request.json();
    const { slide, research, systemPrompt } = body;
    
    if (!slide || !slide.images || slide.images.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid slide data. Must provide exactly 4 images.' },
        { status: 400 }
      );
    }

    // Convert relative URLs to absolute for Claude API
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const imageUrls = slide.images.map(url => {
      // If already absolute URL, use as is
      if (url.startsWith('http')) {
        return url;
      }
      // Otherwise, create absolute URL
      return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    });

    // Generate captions with Claude
    const captions = await generateCaptions(
      imageUrls,
      research,
      systemPrompt
    );

    return NextResponse.json({ captions });
    
  } catch (error) {
    console.error('Error in caption API:', error);
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    );
  }
}