import { GoogleGenerativeAI, FunctionDeclaration, Tool, Part } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the Google Generative AI client
export const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper to invoke Gemini with function/tool schema
export async function invokeGeminiWithTool(
  userPrompt: string,
  toolSchema: FunctionDeclaration, // Use specific type
  toolName: string
) {
  console.log('[Google Gemini] invokeGeminiWithTool started. ToolName:', toolName);

  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-pro-preview-05-06',
  });

  // Correct structure for the 'tools' parameter
  const tools: Tool[] = [{
    functionDeclarations: [toolSchema]
  }];

  // Configure to force the specified function call
  const toolConfig = {
    functionCallingConfig: {
      mode: 'ANY', // Force a function call
      allowedFunctionNames: [toolName] // Specify which function to call
    }
  };

  console.log('[Google Gemini] User prompt length:', userPrompt.length);
  console.log('[Google Gemini] Tool schema name:', toolSchema.name);
  console.log('[Google Gemini] Tool config:', JSON.stringify(toolConfig, null, 2));
  console.log('[Google Gemini] Attempting model.generateContent...');

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      tools: tools, // Corrected tools structure
      toolConfig: toolConfig, // Use toolConfig to force the function
      // When using function calling, responseMimeType: 'application/json' is not supported
    });

    console.log('[Google Gemini] model.generateContent call completed successfully.');

    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      console.error('[Google Gemini] No candidates found in response.');
      throw new Error('No candidates found in Gemini response.');
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'TOOL_CALL') {
      console.warn(`[Google Gemini] Unusual finish reason: ${candidate.finishReason}`);
      if (candidate.finishReason === 'SAFETY') {
        console.error('[Google Gemini] Content blocked due to safety ratings.');
        throw new Error('Gemini content generation failed due to safety policies.');
      }
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('[Google Gemini] No parts found in candidate content.');
      // Try to log response text if available for more clues
      const responseText = response.text();
      console.error('[Google Gemini] Full response text (if any):', responseText);
      throw new Error('No parts found in Gemini response candidate content.');
    }

    const part = candidate.content.parts[0] as Part;

    if (part.functionCall) {
      console.log('[Google Gemini] Function call found. Name:', part.functionCall.name);
      return part.functionCall.args;
    } else if (part.text) {
      console.warn('[Google Gemini] Gemini returned text instead of a function call. Attempting to parse as JSON.');
      console.log('[Google Gemini] Text received (first 100 chars):', part.text.substring(0, 100));
      try {
        const parsedText = JSON.parse(part.text);
        console.log('[Google Gemini] Successfully parsed text as JSON.');
        return parsedText;
      } catch (e) {
        console.error('[Google Gemini] Failed to parse Gemini text response as JSON:', e);
        console.error('[Google Gemini] Raw text received:', part.text);
        if (toolName === 'create_slideshow_plan') {
          console.log('[Google Gemini] Generating mock slideshow plan due to text parsing error.');
          return generateMockSlideShowResponse();
        }
        throw new Error('Invalid JSON text response from Gemini and no function call.');
      }
    } else {
      console.error('[Google Gemini] Part does not contain functionCall or text.');
      throw new Error('Gemini response part is empty or in an unexpected format.');
    }
  } catch (error) {
    console.error('[Google Gemini] Error during model.generateContent or response processing:', error);
    // Log more details if it's a specific error
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('[Google Gemini] Error message:', (error as Error).message);
      if ('stack' in error) console.error('[Google Gemini] Error stack:', (error as Error).stack);
    }

    // Fallback to mock for development if it's the slideshow plan
    if (toolName === 'create_slideshow_plan') {
      console.warn('[Google Gemini] Error occurred, falling back to mock slideshow plan.');
      return generateMockSlideShowResponse();
    }
    throw error; // Re-throw the error to be caught by the calling route
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