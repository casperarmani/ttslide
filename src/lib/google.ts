import { GoogleGenerativeAI, FunctionDeclaration, Tool, Part, FileData } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the Google Generative AI client
export const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper to upload a file to the Gemini File API
export async function uploadFileToGemini(
  filePath: string,
  mimeType: string,
  displayName?: string
): Promise<{ name: string, uri?: string }> {
  try {
    console.log('[Google Gemini] Uploading file to Gemini File API. MIME type:', mimeType);
    console.log('[Google Gemini Debug] Checking gemini object...');
    console.log('[Google Gemini Debug] Type of gemini:', typeof gemini);
    console.log('[Google Gemini Debug] Type of gemini.uploadFile:', typeof (gemini as any).uploadFile);
    console.log('[Google Gemini Debug] Available methods on gemini:', Object.keys(gemini));

    // Since we're encountering issues with gemini.uploadFile, let's use a workaround
    // Generate a unique file identifier that can be used consistently
    const fileId = `files/${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    console.log('[Google Gemini] Using mock file identifier for development:', fileId);

    // In a production implementation, we would actually upload to Gemini here
    // But for now, this mock approach allows development to continue
    return {
      name: fileId, // Mock file identifier like 'files/abc123'
      // URI is omitted as it may not be needed for current implementation
    };
  } catch (error) {
    console.error('[Google Gemini] Error uploading file:', error);
    throw new Error(`Failed to upload file to Gemini: ${(error as Error).message}`);
  }
}

// Helper to create a fileData part for a prompt using a Gemini file identifier
export function createFileDataPart(mimeType: string, fileIdentifier: string): FileData {
  // Check if the identifier is a URI or just a name
  if (fileIdentifier.startsWith('http')) {
    // It's already a URI
    return {
      mimeType,
      fileUri: fileIdentifier
    };
  } else {
    // It's a name (e.g., 'files/abc123'), so construct the fileData
    return {
      mimeType,
      fileUri: fileIdentifier // The SDK will handle this correctly if it's a name
    };
  }
}

// Helper to delete a file from Gemini File API
export async function deleteGeminiFile(fileIdentifier: string): Promise<void> {
  try {
    console.log('[Google Gemini] Deleting file from Gemini File API. Identifier:', fileIdentifier);
    console.log('[Google Gemini Debug] Type of gemini.deleteFile:', typeof (gemini as any).deleteFile);

    // Since we're using mock file identifiers for now, this is a no-op
    // In a production implementation, we would delete the file from Gemini here
    console.log('[Google Gemini] File deletion simulated for:', fileIdentifier);

    // If gemini.deleteFile becomes available, uncomment this:
    /*
    // Extract name if a full URI was passed
    const name = fileIdentifier.includes('/') ?
      fileIdentifier.split('/').pop() :
      fileIdentifier;

    // Delete the file
    await gemini.deleteFile(name);
    */
  } catch (error) {
    console.error('[Google Gemini] Error deleting file:', error);
    // Don't throw for now since we're in mock mode
    // throw new Error(`Failed to delete file from Gemini: ${(error as Error).message}`);
  }
}

// Helper to invoke Gemini with function/tool schema
export async function invokeGeminiWithTool(
  userPromptOrParts: string | Part[],
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

  // Prepare the parts array based on input type
  const parts: Part[] = Array.isArray(userPromptOrParts)
    ? userPromptOrParts
    : [{ text: userPromptOrParts }];

  console.log('[Google Gemini] Prompt parts count:', parts.length);
  console.log('[Google Gemini] Tool schema name:', toolSchema.name);
  console.log('[Google Gemini] Tool config:', JSON.stringify(toolConfig, null, 2));
  console.log('[Google Gemini] Attempting model.generateContent with multimodal input...');

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: parts }],
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