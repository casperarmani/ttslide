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

      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: userPromptInstruction }
          ]
        },
        // Add an assistant pre-fill to guide the model towards JSON
        {
          role: 'assistant',
          content: [{ type: 'text', text: '{"captions": [' }] // Start the JSON structure
        }
      ];

      console.log(`[Claude attempt ${attempt + 1}] Generating captions. System prompt: ${systemPrompt}`); // System prompt is still passed if needed elsewhere, but userPromptInstruction is primary for Claude now.

      const response = await claude.messages.create({
        model: 'claude-3-7-sonnet-20250219', // Using the original model from your codebase
        max_tokens: 400, // Keep it reasonable for 4 short captions
        system: systemPrompt, // The original system prompt for context
        messages: messages,
      });

      if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        console.error('[Claude] API response content is empty or not in expected format:', response);
        throw new Error('Invalid response format from Claude API: No content found.');
      }

      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock) {
        console.error('[Claude] API response does not contain a text block:', response.content);
        throw new Error('Invalid response format from Claude API: No text block found.');
      }

      let responseText = textBlock.text;

      // If we used assistant pre-fill, the response might start directly after our pre-fill
      // We need to complete the JSON structure.
      // The pre-fill was `{"captions": [`
      // So, if the responseText starts with ` "Caption A", ...`, we need to complete it.
      // A more robust way is to ensure the full JSON is extracted.
      // Let's try to find a JSON block.

      const jsonMatch = responseText.match(/{[\s\S]*}/);
      if (jsonMatch && jsonMatch[0]) {
        responseText = jsonMatch[0];
        console.log('[Claude] Extracted JSON block:', responseText);
        const parsedResponse = JSON.parse(responseText);
        if (parsedResponse.captions && Array.isArray(parsedResponse.captions) && parsedResponse.captions.length === imageUrls.length) {
          return parsedResponse.captions;
        } else {
          console.error('[Claude] Parsed JSON does not have the expected structure:', parsedResponse);
          throw new SyntaxError("Parsed JSON missing 'captions' array or wrong length.");
        }
      } else {
         // If assistant pre-fill was `{"captions": [` and Claude just gives the array content plus closing.
         // Example: ` "caption1", "caption2", "caption3", "caption4"]}`
         // We need to prepend `{"captions": [` if it's not a full JSON object.
        if (!responseText.trim().startsWith("{")) {
          responseText = `{"captions": [${responseText}`; // This assumes pre-fill worked as intended
        }
        // Ensure it's a complete JSON structure, attempting to fix if Claude only returned the array content + end
        if (responseText.endsWith("]")) { // If it ends with ] but not }
            responseText += "}";
        } else if (!responseText.endsWith("]}")) { // If it doesn't end with ]} but should
            // This part is tricky and error-prone. Better to rely on stronger prompting.
            // For now, we'll assume the refined prompt + prefill is better.
        }

        console.log('[Claude] Attempting to parse potentially partial JSON:', responseText);
        const parsedResponse = JSON.parse(responseText);
         if (parsedResponse.captions && Array.isArray(parsedResponse.captions) && parsedResponse.captions.length === imageUrls.length) {
          return parsedResponse.captions;
        } else {
          console.error('[Claude] Parsed JSON does not have the expected structure (after attempting fix):', parsedResponse);
          throw new SyntaxError("Parsed JSON missing 'captions' array or wrong length after fix attempt.");
        }
      }

    } catch (error: any) {
      console.error(`[Claude] Error on attempt ${attempt + 1}:`, error.message, error); // Log the full error object

      // Check for Anthropic APIError structure
      const apiErrorType = error?.error?.type;
      const apiErrorMessage = error?.error?.message;
      const errorStatus = error?.status;

      if (errorStatus === 404 && apiErrorType === 'not_found_error') {
         console.error(`[Claude] Model not found: ${apiErrorMessage}. Please check the model name and your API access.`);
         // This is a non-recoverable error for this function, so break and fall to mock.
         attempt = maxRetries + 1; // Force exit from loop
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
        console.warn('[Claude] JSON parsing error. Content from Claude:', error.message.includes('textBlock is not defined') ? 'Likely no text block in response' : (typeof responseText !== 'undefined' ? responseText : 'responseText not defined'));
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
    "Tired of sleepless nights? (Mock)",
    "Tossing and turning won't stop (Mock)",
    "Wake up refreshed and renewed (Mock)",
    "Try SleepEase, fall asleep in minutes (Mock)"
  ];
  return mockCaptions.slice(0, count);
}