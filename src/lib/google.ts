import { GoogleGenAI, Part, FileData, FunctionDeclaration, Tool } from "@google/genai";
import fs from 'fs';
import path from 'path';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the new GoogleGenAI client
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to upload a file to the Gemini File API
export async function uploadFileToGemini(
  filePath: string,
  mimeType: string,
  displayName?: string
): Promise<{ name: string, uri: string, displayName?: string, mimeType: string, sizeBytes: number }> {
  try {
    console.log(`[Google Gemini] Uploading file to Gemini File API: ${displayName || filePath}. MIME type: ${mimeType}`);

    const response = await gemini.files.upload({
      file: filePath, // Pass the file path directly
      config: {
        mimeType: mimeType,
        displayName: displayName || path.basename(filePath) // Use path.basename if displayName not provided
      }
    });

    // The response object directly is the File object
    // It contains: name, displayName, mimeType, sizeBytes, createTime, updateTime, expirationTime, uri
    console.log(`[Google Gemini] File uploaded successfully. Name: ${response.name}, URI: ${response.uri}`);
    return {
      name: response.name,
      uri: response.uri,
      displayName: response.displayName,
      mimeType: response.mimeType,
      sizeBytes: response.sizeBytes
    };
  } catch (error) {
    console.error(`[Google Gemini] Error uploading file "${displayName || filePath}":`, error);
    throw new Error(`Failed to upload file to Gemini: ${(error as Error).message}`);
  }
}

// Helper to create a fileData part for a prompt using a Gemini file identifier
export function createFileDataPart(mimeType: string, fileUri: string): Part {
  // Create a part with fileData
  return {
    fileData: {
      mimeType,
      fileUri
    }
  };
}

// Helper to delete a file from Gemini File API
export async function deleteGeminiFile(fileIdentifier: string): Promise<void> {
  try {
    console.log(`[Google Gemini] Deleting file from Gemini File API. Identifier: ${fileIdentifier}`);

    // The fileIdentifier should be the 'name' of the file (e.g., "files/xxx")
    const nameToDelete = fileIdentifier.startsWith('gs://')
                       ? fileIdentifier.substring(fileIdentifier.lastIndexOf('/') + 1) // Extract name from gs:// URI
                       : fileIdentifier;

    await gemini.files.delete({ name: nameToDelete });
    console.log(`[Google Gemini] File deleted successfully: ${nameToDelete}`);
  } catch (error) {
    console.error(`[Google Gemini] Error deleting file "${fileIdentifier}":`, error);
    // Log warning but don't throw to allow batch operation to continue
    console.warn(`[Google Gemini] Non-fatal: Failed to delete file ${fileIdentifier}. It will auto-expire in 48h.`);
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
    model: 'gemini-2.5-flash', // Using faster model that supports files
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