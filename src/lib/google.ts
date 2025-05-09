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
    throw new Error('Invalid JSON response from Gemini');
  }
}