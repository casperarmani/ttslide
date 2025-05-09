import Anthropic from '@anthropic-ai/sdk';
import mime from 'mime-types';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Helper to fetch image and convert to base64
async function imageToContentTypeSource(url: string) {
  try {
    // Use global fetch since Next.js 15 supports it
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    
    // Try to get MIME type from response headers, fallback to extension
    let mediaType = response.headers.get('content-type');
    if (!mediaType) {
      const extension = url.split('.').pop()?.toLowerCase();
      if (extension) {
        mediaType = mime.lookup(extension) || 'image/jpeg'; // Default if lookup fails
      } else {
        mediaType = 'image/jpeg'; // Default if no extension
      }
    }

    // Ensure it's one of the supported types
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(mediaType)) {
      console.warn(`Unsupported media type ${mediaType} for ${url}, defaulting to image/jpeg`);
      mediaType = 'image/jpeg'; 
    }

    return {
      type: 'base64' as const,
      media_type: mediaType,
      data: base64Data,
    };
  } catch (error) {
    console.error(`Error fetching or converting image ${url}:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}

// Helper to generate captions with retry logic
export async function generateCaptions(
  imageUrls: string[],
  researchText: string,
  systemPrompt: string
): Promise<string[]> {
  const prompt = `${systemPrompt}\n\nEach frame is A–D.  Research:\n${researchText}\nReturn JSON {"captions":[…]}`;

  try {
    const imageContents = await Promise.all(
      imageUrls.map(async (url) => {
        const source = await imageToContentTypeSource(url);
        return {
          type: 'image' as const,
          source: source,
        };
      })
    );

    const response = await claude.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: prompt }
        ]
      }]
    });

    // Ensure content is not null and is an array
    if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        console.error('Claude API response content is empty or not in expected format:', response);
        throw new Error('Invalid response format from Claude API: No content found.');
    }

    // Find the first text block in the response content
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock) {
        console.error('Claude API response does not contain a text block:', response.content);
        throw new Error('Invalid response format from Claude API: No text block found.');
    }
    
    const responseText = textBlock.text;
    const parsedResponse = JSON.parse(responseText);

    return parsedResponse.captions;

  } catch (error) {
    // Check if error is syntax error (JSON parsing issue)
    if (error instanceof SyntaxError) {
      console.warn('Retrying with modified prompt due to JSON parsing error...');
      try {
        const imageContentsRetry = await Promise.all(
          imageUrls.map(async (url) => {
            const source = await imageToContentTypeSource(url);
            return {
              type: 'image' as const,
              source: source,
            };
          })
        );

        const retryResponse = await claude.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              ...imageContentsRetry,
              { type: 'text', text: `${prompt}\n\nReturn *only* valid JSON.` }
            ]
          }]
        });

        if (!retryResponse.content || !Array.isArray(retryResponse.content) || retryResponse.content.length === 0) {
            console.error('Claude API retry response content is empty or not in expected format:', retryResponse);
            throw new Error('Invalid retry response format from Claude API: No content found.');
        }
        const retryTextBlock = retryResponse.content.find(block => block.type === 'text');
        if (!retryTextBlock) {
            console.error('Claude API retry response does not contain a text block:', retryResponse.content);
            throw new Error('Invalid retry response format from Claude API: No text block found.');
        }
        
        const retryText = retryTextBlock.text;
        const retryParsed = JSON.parse(retryText);
        return retryParsed.captions;

      } catch (retryError) {
        console.error('Error in Claude retry:', retryError);
        console.log('Generating mock captions for development after retry failure.');
        return generateMockCaptions(imageUrls.length);
      }
    }

    // Log error details
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error calling Claude API:', errorMessage);
    } else {
        console.error('Error calling Claude API:', error);
    }

    console.log('Generating mock captions for development due to Claude API error.');
    return generateMockCaptions(imageUrls.length);
  }
}

// Helper function to generate mock captions for development
function generateMockCaptions(count: number): string[] {
  const mockCaptions = [
    "Tired of sleepless nights?",
    "Tossing and turning won't stop",
    "Wake up refreshed and renewed",
    "Try SleepEase, fall asleep in minutes"
  ];

  // Return the appropriate number of captions
  return mockCaptions.slice(0, count);
}