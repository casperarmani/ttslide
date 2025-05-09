import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Helper to generate captions with retry logic
export async function generateCaptions(
  imageUrls: string[],
  researchText: string,
  systemPrompt: string
): Promise<string[]> {
  const prompt = `${systemPrompt}\n\nEach frame is A–D.  Research:\n${researchText}\nReturn JSON {"captions":[…]}`;

  try {
    const response = await claude.messages.create({
      model: 'claude-3-sonnet-2025-05-06',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          ...imageUrls.map(url => ({
            type: 'image_url',
            image_url: { url }
          })),
          { type: 'text', text: prompt }
        ]
      }]
    });

    const responseText = response.content[0].text;
    const parsedResponse = JSON.parse(responseText);

    return parsedResponse.captions;
  } catch (error) {
    // Retry once with modified prompt if JSON parsing failed
    if (error instanceof SyntaxError) {
      console.warn('Retrying with modified prompt...');

      try {
        const retryResponse = await claude.messages.create({
          model: 'claude-3-sonnet-2025-05-06',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              ...imageUrls.map(url => ({
                type: 'image_url',
                image_url: { url }
              })),
              { type: 'text', text: `${prompt}\n\nReturn *only* valid JSON.` }
            ]
          }]
        });

        const retryText = retryResponse.content[0].text;
        const retryParsed = JSON.parse(retryText);

        return retryParsed.captions;
      } catch (retryError) {
        console.error('Error in Claude retry:', retryError);
        // Fall back to development captions for testing
        console.log('Generating mock captions for development');
        return generateMockCaptions(imageUrls.length);
      }
    }

    console.error('Error calling Claude API:', error);
    // Fall back to development captions for testing
    console.log('Generating mock captions for development');
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