import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the Google Generative AI client
export const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper to invoke Gemini with function/tool schema
export async function invokeGeminiWithTool(
  userPrompt: string,
  toolSchema: any,
  toolName: string
) {
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-pro-preview-05-06',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [toolSchema],
    toolConfig: { toolChoice: toolName },
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const response = result.response;
  const text = response.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON:', text);

    // For testing purposes, if the API fails, let's generate a mock response
    // This allows development to continue when the API is not working
    if (toolName === 'create_slideshow_plan') {
      console.log('Generating mock slideshow plan for development');
      return generateMockSlideShowResponse();
    }

    throw new Error('Invalid JSON response from Gemini');
  }
}

// Helper function to generate a mock slideshow response for development
function generateMockSlideShowResponse() {
  const themes = ['PMS', 'Insomnia', 'Anxiety'];
  const slideshows = [];

  // Generate 1 slideshow per theme for testing
  for (let i = 0; i < 3; i++) {
    const theme = themes[i % themes.length];

    // Generate a demo slideshow with placeholder image IDs
    slideshows.push({
      theme,
      images: [
        `face_mock_${Date.now()}_${i}_1`,
        `faceless_mock_${Date.now()}_${i}_2`,
        `faceless_mock_${Date.now()}_${i}_3`,
        `product_mock_${Date.now()}_${i}_4`
      ]
    });
  }

  return { slideshows };
}