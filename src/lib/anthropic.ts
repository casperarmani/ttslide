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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    
    let mediaType = response.headers.get('content-type');
    if (!mediaType) {
      const extension = url.split('.').pop()?.toLowerCase();
      mediaType = extension ? (mime.lookup(extension) || 'image/jpeg') : 'image/jpeg';
    }

    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(mediaType)) {
      console.warn(`Unsupported media type ${mediaType} for ${url}, defaulting to image/jpeg`);
      mediaType = 'image/jpeg';
    }

    return {
      type: 'base64' as const,
      media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', // More specific type
      data: base64Data,
    };
  } catch (error) {
    console.error(`Error fetching or converting image ${url}:`, error);
    throw error;
  }
}

// Helper to generate captions with retry logic for parsing and rate limits
export async function generateCaptions(
  imageUrls: string[],
  researchText: string,
  systemPrompt: string, // Keep the original system prompt parameter
  maxRetries = 2, // Max retries for rate limits or other transient errors
  initialDelay = 1000 // Initial delay for retries in ms
): Promise<string[]> {

  // Refined prompt structure for better JSON adherence
  const userPromptInstruction = `For each of the 4 images provided (Frames A-D), write one overlay caption (maximum 8 words each).
Follow the PAS narrative structure:
Frame A (Hook/Pain): Identify a pain point or grab attention.
Frame B (Twist): Amplify the pain or introduce a complication.
Frame C (Dream Outcome): Show the desired relief or positive outcome.
Frame D (Product Call-to-Action): Connect the outcome to a product/solution.

Use the provided research text for insight:
<research_text>
${researchText}
</research_text>

Respond STRICTLY with a JSON object in the following format:
{"captions": ["Caption for Frame A", "Caption for Frame B", "Caption for Frame C", "Caption for Frame D"]}`;

  let attempt = 0;
  let delay = initialDelay;

  while (attempt <= maxRetries) {
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

      // Removed assistant pre-fill message as per API error when thinking is enabled
      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: userPromptInstruction }
          ]
        }
      ];

      console.log(`[Claude attempt ${attempt + 1}] Generating captions with extended thinking. System prompt: ${systemPrompt}`);

      const response = await claude.messages.create({
        model: 'claude-3-7-sonnet-20250219', // Using the original model from your codebase
        max_tokens: 1500, // Increased to accommodate thinking budget + caption output
        thinking: {
          type: 'enabled',
          budget_tokens: 1024 // Minimum required budget for internal reasoning
        },
        system: systemPrompt, // The original system prompt for context
        messages: messages,
      });

      if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        console.error('[Claude] API response content is empty or not in expected format:', response);
        throw new Error('Invalid response format from Claude API: No content found.');
      }

      // When using thinking parameter, we need more robust handling of content blocks
      // Filter all text blocks from response content
      const assistantTextBlocks = response.content.filter(
        block => block.type === 'text' && typeof block.text === 'string'
      );

      if (assistantTextBlocks.length === 0) {
        console.error('[Claude] API response does not contain any text blocks after enabling thinking:', response.content);
        throw new Error('Invalid response format from Claude API: No text blocks found.');
      }

      // Assume the last text block is the most relevant final answer
      let responseText = assistantTextBlocks[assistantTextBlocks.length - 1].text;
      console.log('[Claude] Raw text from final assistant block:', responseText);

      // With thinking enabled and no pre-fill, we expect a complete JSON response
      // We'll still extract JSON to be safe, in case there's any preamble
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      if (jsonMatch && jsonMatch[0]) {
        responseText = jsonMatch[0];
        console.log('[Claude] Extracted JSON block:', responseText);
      }
      
      try {
        // Now attempt to parse the responseText as JSON
        const parsedResponse = JSON.parse(responseText);
        if (parsedResponse.captions && Array.isArray(parsedResponse.captions) && parsedResponse.captions.length === imageUrls.length) {
          return parsedResponse.captions;
        } else {
          console.error('[Claude] Parsed JSON does not have the expected structure:', parsedResponse);
          throw new SyntaxError("Parsed JSON missing 'captions' array or wrong length.");
        }
      } catch (jsonError) {
        console.error('[Claude] Failed to parse JSON response:', jsonError);
        console.log('[Claude] Raw response that failed JSON parsing:', responseText);
        throw jsonError; // Rethrow to be caught by the outer try-catch
      }

    } catch (error: any) {
      console.error(`[Claude] Error on attempt ${attempt + 1}:`, error.message, error); // Log the full error object

      // Check for Anthropic APIError structure
      const apiErrorType = error?.error?.type;
      const apiErrorMessage = error?.error?.message;
      const errorStatus = error?.status;

      if ((errorStatus === 400 && apiErrorType === 'invalid_request_error' &&
          (apiErrorMessage?.includes('thinking.enabled.budget_tokens') || apiErrorMessage?.includes('messages.1.content.0.type'))) ||
          (errorStatus === 404 && apiErrorType === 'not_found_error')) {
         console.error(`[Claude] Non-recoverable API parameter error or model not found: ${apiErrorMessage}. Stopping retries for this call.`);
         attempt = maxRetries + 1; // Force exit from loop to go to mock data
         continue;
      }

      if (errorStatus === 429 || apiErrorType === 'rate_limit_error') {
        const retryAfterHeader = error.headers ? (error.headers['retry-after'] || error.headers['Retry-After']) : null;
        let waitTime = delay;
        if (retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds)) {
            waitTime = retryAfterSeconds * 1000;
            console.log(`[Claude] Rate limit hit. Retrying after ${retryAfterSeconds} seconds from header.`);
          }
        } else {
          console.log(`[Claude] Rate limit hit. Retrying after ${waitTime / 1000} seconds (exponential backoff).`);
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          delay *= 2; // Exponential backoff
          attempt++;
          continue;
        } else {
          console.error('[Claude] Max retries reached for rate limit error.');
          // Fall through to generate mock captions if all retries fail
        }
      } else if (error instanceof SyntaxError) {
        console.warn('[Claude] JSON parsing error. Content from Claude was:', (typeof responseText !== 'undefined' ? responseText : 'responseText variable was not defined before parsing attempt'));
        if (attempt < maxRetries) {
          // No specific retry for syntax error here as the prompt is already strong.
          // We will fall through to mock if it consistently fails.
          // A more advanced strategy could be to try a simpler prompt on retry for syntax.
        }
      }
      // For other errors, or if retries exhausted for rate limits / syntax errors not resolved

      if (attempt >= maxRetries) {
        console.error('[Claude] All attempts failed or error is non-recoverable. Generating mock captions.', error);
        return generateMockCaptions(imageUrls.length);
      }
      attempt++; // For errors not handled by specific retry conditions, increment attempt and let loop decide
    }
  }
  // Should not be reached if logic is correct, but as a failsafe:
  console.warn('[Claude] Exited retry loop unexpectedly. Generating mock captions.');
  return generateMockCaptions(imageUrls.length);
}

// Helper function to generate mock captions for development
function generateMockCaptions(count: number): string[] {
  const mockCaptions = [
    "Tired of sleepless nights? (Mock/Thinking)",
    "Tossing and turning won't stop (Mock/Thinking)",
    "Wake up refreshed and renewed (Mock/Thinking)",
    "Try SleepEase, fall asleep in minutes (Mock/Thinking)"
  ];
  return mockCaptions.slice(0, count);
}