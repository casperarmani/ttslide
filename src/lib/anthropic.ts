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
    }
    
    throw error;
  }
}