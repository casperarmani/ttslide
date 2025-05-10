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
    console.log(`[Google GenAI] Uploading file to Gemini File API: ${displayName || filePath}. MIME type: ${mimeType}`);

    // Verify the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const response = await gemini.files.upload({
      file: filePath, // Pass the file path directly
      config: {
        mimeType: mimeType,
        displayName: displayName || path.basename(filePath) // Use path.basename if displayName not provided
      }
    });

    // The response object directly is the File object
    // It contains: name, displayName, mimeType, sizeBytes, createTime, updateTime, expirationTime, uri
    console.log(`[Google GenAI] File uploaded successfully. Name: ${response.name}, URI: ${response.uri}`);

    // Log the URI format we received
    if (!response.uri) {
      console.warn(`[Google GenAI] Uploaded file but received no URI`);
    } else {
      console.log(`[Google GenAI] Received URI format: ${response.uri.split('/')[0]}//...`);
    }

    return {
      name: response.name,
      uri: response.uri,
      displayName: response.displayName,
      mimeType: response.mimeType,
      sizeBytes: response.sizeBytes
    };
  } catch (error) {
    console.error(`[Google GenAI] Error uploading file "${displayName || filePath}":`, error);
    throw new Error(`Failed to upload file to Gemini: ${(error as Error).message}`);
  }
}

// Helper to create a fileData part for a prompt using a Gemini file URI
export function createFilePartFromFileAPI(mimeType: string, fileUri: string): Part {
  if (!fileUri) {
    console.warn(`[Google GenAI] Attempting to create file part with empty URI. This will fail.`);
  } else if (!fileUri.startsWith('https://') && !fileUri.startsWith('gs://')) {
    console.warn(`[Google GenAI] URI format doesn't start with https:// or gs://: ${fileUri}. This may fail.`);
  }

  // Create a part with fileData
  return {
    fileData: {
      mimeType,
      fileUri
    }
  };
}

// Legacy function alias for backward compatibility
export function createFileDataPart(mimeType: string, fileUri: string): Part {
  return createFilePartFromFileAPI(mimeType, fileUri);
}

// Helper to delete a file from Gemini File API
export async function deleteGeminiFile(fileIdentifier: string): Promise<void> {
  try {
    console.log(`[Google GenAI] Deleting file from Gemini File API. Identifier: ${fileIdentifier}`);

    // The fileIdentifier should be the 'name' of the file (e.g., "files/xxx")
    // Ensure it's in the correct format
    if (!fileIdentifier || !fileIdentifier.startsWith('files/')) {
      console.warn(`[Google GenAI] Invalid file identifier for deletion: ${fileIdentifier}. Deletion skipped.`);
      return;
    }

    await gemini.files.delete({ name: fileIdentifier });
    console.log(`[Google GenAI] File deleted successfully: ${fileIdentifier}`);
  } catch (error) {
    console.error(`[Google GenAI] Error deleting file "${fileIdentifier}":`, error);
    // Log warning but don't throw to allow batch operation to continue
    console.warn(`[Google GenAI] Non-fatal: Failed to delete file ${fileIdentifier}. It will auto-expire in 48h.`);
  }
}

// Helper to invoke Gemini with function/tool schema
export async function invokeGeminiWithTool(
  userPromptOrParts: string | Part[],
  toolSchema: FunctionDeclaration, // Use specific type
  toolName: string
) {
  console.log('[Google GenAI] invokeGeminiWithTool started. ToolName:', toolName);

  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-pro-preview-05-06', // Using the specified model that supports files
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

  console.log('[Google GenAI] Prompt parts count:', parts.length);
  console.log('[Google GenAI] Tool schema name:', toolSchema.name);
  console.log('[Google GenAI] Tool config:', JSON.stringify(toolConfig, null, 2));
  console.log('[Google GenAI] Attempting model.generateContent with multimodal input...');

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: parts }],
      tools: tools, // Corrected tools structure
      toolConfig: toolConfig, // Use toolConfig to force the function
      // When using function calling, responseMimeType: 'application/json' is not supported
    });

    console.log('[Google GenAI] model.generateContent call completed successfully.');

    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      console.error('[Google GenAI] No candidates found in response.');
      throw new Error('No candidates found in Gemini response.');
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'TOOL_CALL') {
      console.warn(`[Google GenAI] Unusual finish reason: ${candidate.finishReason}`);
      if (candidate.finishReason === 'SAFETY') {
        console.error('[Google GenAI] Content blocked due to safety ratings.');
        throw new Error('Gemini content generation failed due to safety policies.');
      }
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('[Google GenAI] No parts found in candidate content.');
      // Try to log response text if available for more clues
      const responseText = response.text();
      console.error('[Google GenAI] Full response text (if any):', responseText);
      throw new Error('No parts found in Gemini response candidate content.');
    }

    const part = candidate.content.parts[0] as Part;

    if (part.functionCall) {
      console.log('[Google GenAI] Function call found. Name:', part.functionCall.name);
      return part.functionCall.args;
    } else if (part.text) {
      console.warn('[Google GenAI] Gemini returned text instead of a function call. Attempting to parse as JSON.');
      console.log('[Google GenAI] Text received (first 100 chars):', part.text.substring(0, 100));
      try {
        const parsedText = JSON.parse(part.text);
        console.log('[Google GenAI] Successfully parsed text as JSON.');
        return parsedText;
      } catch (e) {
        console.error('[Google GenAI] Failed to parse Gemini text response as JSON:', e);
        console.error('[Google GenAI] Raw text received:', part.text);
        if (toolName === 'create_slideshow_plan') {
          console.log('[Google GenAI] Generating mock slideshow plan due to text parsing error.');
          return generateMockSlideShowResponse();
        }
        throw new Error('Invalid JSON text response from Gemini and no function call.');
      }
    } else {
      console.error('[Google GenAI] Part does not contain functionCall or text.');
      throw new Error('Gemini response part is empty or in an unexpected format.');
    }
  } catch (error) {
    console.error('[Google GenAI] Error during model.generateContent or response processing:', error);
    // Log more details if it's a specific error
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('[Google GenAI] Error message:', (error as Error).message);
      if ('stack' in error) console.error('[Google GenAI] Error stack:', (error as Error).stack);
    }

    // Fallback to mock for development if it's the slideshow plan
    if (toolName === 'create_slideshow_plan') {
      console.warn('[Google GenAI] Error occurred, falling back to mock slideshow plan.');
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