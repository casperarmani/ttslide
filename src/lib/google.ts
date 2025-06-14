import { GoogleGenAI, Part, FunctionDeclaration, Tool } from "@google/genai";
import fs from 'fs';
import fsp from 'fs/promises'; // Node FS Promises module for async file operations
import path from 'path';
import os from 'os'; // Node OS module for temp directory
import { v4 as uuidv4 } from 'uuid'; // For unique temp filenames
import mime from 'mime-types'; // Already imported elsewhere in the codebase

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the GoogleGenAI client
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to upload a file to the Gemini File API from a local filesystem path
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

    // Log the URI format we received (should be https:// for the API)
    if (!response.uri) {
      console.warn(`[Google GenAI] Uploaded file but received no URI`);
    } else {
      console.log(`[Google GenAI] Received URI format: ${response.uri.split('/')[0]}//...`);
    }

    return {
      name: response.name || '',
      uri: response.uri || '',
      displayName: response.displayName,
      mimeType: response.mimeType || '',
      sizeBytes: typeof response.sizeBytes === 'number' ? response.sizeBytes : 0
    };
  } catch (error) {
    console.error(`[Google GenAI] Error uploading file "${displayName || filePath}":`, error);
    throw new Error(`Failed to upload file to Gemini: ${(error as Error).message}`);
  }
}

// Helper to upload a file to the Gemini File API from a Blob URL
export async function uploadFileToGeminiFromUrl(
  blobUrl: string,
  mimeType: string,
  displayName: string
): Promise<{ name: string, uri: string, displayName?: string, mimeType: string, sizeBytes: number }> {

  let tempFilePath: string | null = null; // Store temp path for cleanup

  // Define fileConfig early to avoid ReferenceError in catch block if fetch fails early
  const fileConfig = { // This remains the same
    mimeType: mimeType,
    displayName: displayName,
  };

  try {
    console.log(`[Google GenAI WORKAROUND] Uploading from Blob URL via Temp File: ${displayName}. MIME type: ${mimeType}`);

    // 1. Fetch the image content from the Blob URL
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`[WORKAROUND] Failed to fetch image from Blob URL: ${response.statusText} (URL: ${blobUrl})`);
    }
    console.log('[Google GenAI WORKAROUND] Fetched blob content.');

    // 2. Get buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    const sizeInBytes = buffer.length; // We'll use this for the return value if needed
    console.log(`[Google GenAI WORKAROUND] Created buffer, size: ${sizeInBytes} bytes`);
    if (sizeInBytes <= 0) {
        throw new Error('[Google GenAI WORKAROUND] Fetched buffer is empty.');
    }

    // 3. Write buffer to a temporary file
    const tempDir = os.tmpdir(); // Get OS temporary directory
    const uniqueSuffix = uuidv4();
    // Attempt to get a reasonable extension for the temp file
    let fileExtension = path.extname(displayName);
    if (!fileExtension) { // If original name had no extension
        const mimeExtension = mime.extension(mimeType); // Get extension from MIME type
        fileExtension = mimeExtension ? `.${mimeExtension}` : '.tmp';
    }
    tempFilePath = path.join(tempDir, `gemini-upload-${uniqueSuffix}${fileExtension}`);

    console.log(`[Google GenAI WORKAROUND] Writing buffer to temp file: ${tempFilePath}`);
    await fsp.writeFile(tempFilePath, buffer); // Using fs/promises for async write
    console.log(`[Google GenAI WORKAROUND] Successfully wrote temp file.`);

    // 4. Upload using the temporary file path (this calls your existing uploadFileToGemini)
    //    The uploadFileToGemini function will handle console logging for the actual upload.
    console.log(`[Google GenAI WORKAROUND] Calling original uploadFileToGemini with path: ${tempFilePath}`);
    const geminiFileResponse = await uploadFileToGemini(
      tempFilePath,
      fileConfig.mimeType, // Pass mimeType from fileConfig
      fileConfig.displayName // Pass displayName from fileConfig
    );
    // uploadFileToGemini already logs success, so we don't need another one here.

    // 5. Return result (using data from geminiFileResponse from uploadFileToGemini)
    return {
      name: geminiFileResponse.name,
      uri: geminiFileResponse.uri,
      displayName: geminiFileResponse.displayName,
      mimeType: geminiFileResponse.mimeType,
      sizeBytes: geminiFileResponse.sizeBytes
    };

  } catch (error) {
    console.error(`[Google GenAI WORKAROUND] Error during upload for "${displayName}" from Blob URL "${blobUrl}":`, error);
    // Log error details
    if (error && typeof error === 'object') {
      if ('name' in error) console.error('[Google GenAI WORKAROUND] Error name:', (error as any).name);
      if ('message' in error) console.error('[Google GenAI WORKAROUND] Error message:', (error as any).message);
      if ('response' in error && (error as any).response) {
        console.error('[Google GenAI WORKAROUND] Error response:', JSON.stringify((error as any).response, null, 2));
      }
      if ('code' in error) console.error('[Google GenAI WORKAROUND] Error code:', (error as any).code);
    } else {
      console.error('[Google GenAI WORKAROUND] Non-object error:', error);
    }
    // Log fileConfig on error
    console.error('[Google GenAI WORKAROUND] fileConfig on error:', fileConfig);

    throw new Error(`[WORKAROUND] Failed to upload from Blob URL to Gemini: ${(error as Error).message}`);

  } finally {
    // 6. Clean up the temporary file if it was created
    if (tempFilePath) {
      try {
        console.log(`[Google GenAI WORKAROUND] Cleaning up temp file: ${tempFilePath}`);
        if (fs.existsSync(tempFilePath)) { // Check if file exists before unlinking
            await fsp.unlink(tempFilePath); // Using fs/promises for async unlink
            console.log(`[Google GenAI WORKAROUND] Successfully deleted temp file.`);
        } else {
            console.log(`[Google GenAI WORKAROUND] Temp file ${tempFilePath} already deleted or was not created.`);
        }
      } catch (cleanupError) {
        console.warn(`[Google GenAI WORKAROUND] Failed to delete temp file ${tempFilePath}:`, cleanupError);
      }
    }
  }
}

// Helper to create a fileData part for a prompt using a Gemini file URI
export function createFilePartFromFileAPI(mimeType: string, fileUri: string): Part {
  if (!fileUri) {
    console.warn(`[Google GenAI] Attempting to create file part with empty URI. This will fail.`);
  } else if (!fileUri.startsWith('https://') && !fileUri.startsWith('gs://')) {
    console.warn(`[Google GenAI] URI format doesn't start with https:// or gs://: ${fileUri}. This may fail.`);
  }
  
  // Create a part with fileData - the Gemini API accepts both https://generativelanguage.googleapis.com
  // and gs:// URIs for file references
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
  toolSchema: any, // Using any to bypass the type checking for toolSchema
  toolName: string
) {
  console.log('[Google GenAI] invokeGeminiWithTool started. ToolName:', toolName);

  // Correct structure for the 'tools' parameter
  const tools: Tool[] = [{
    functionDeclarations: [toolSchema as FunctionDeclaration]
  }];

  // Configure to force the specified function call
  const toolConfig = {
    functionCallingConfig: {
      mode: 'ANY',
      allowedFunctionNames: [toolName]
    }
  };

  // Prepare the parts array based on input type
  const parts: Part[] = Array.isArray(userPromptOrParts)
    ? userPromptOrParts
    : [{ text: userPromptOrParts }];

  console.log('[Google GenAI] Prompt parts count:', parts.length);
  console.log('[Google GenAI] Tool schema name:', toolSchema.name);
  console.log('[Google GenAI] Tool config:', JSON.stringify(toolConfig, null, 2));
  console.log('[Google GenAI] Attempting gemini.models.generateContent with multimodal input...');

  try {
    // result directly IS the GenerateContentResponse
    // Cast to any to bypass the type checking issues with the API
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-pro-preview-05-06',
      contents: [{ role: 'user', parts: parts }],
      // @ts-ignore - tools is expected by the API but missing from the type definition
      tools: tools,
      // @ts-ignore - toolConfig is expected by the API but missing from the type definition
      toolConfig: toolConfig,
    } as any);

    console.log('[Google GenAI] gemini.models.generateContent call completed successfully.');

    // Access candidates directly from the result object
    const candidate = result.candidates?.[0];

    if (!candidate) {
      console.error('[Google GenAI] No candidates found in response.');
      // Try to get text from result
      let responseText = "No text available in result.";
      try {
        // Try to access the text property if it exists
        if (result && 'text' in result) {
          responseText = String(result.text); // Access the text property directly
        }
      } catch (textError) {
        console.warn('[Google GenAI] Could not retrieve text from result:', textError);
      }
      console.error('[Google GenAI] Full response text (if any):', responseText);
      console.error('[Google GenAI] Full result object for debugging:', JSON.stringify(result, null, 2)); // Log the whole result
      throw new Error('No candidates found in Gemini response.');
    }

    // Check finish reason, comparing as string to avoid type issues
    const finishReasonStr = String(candidate.finishReason);
    if (candidate.finishReason && finishReasonStr !== 'STOP' && finishReasonStr !== 'TOOL_CALL') {
      console.warn(`[Google GenAI] Unusual finish reason: ${finishReasonStr}`);
      if (finishReasonStr === 'SAFETY') {
        console.error('[Google GenAI] Content blocked due to safety ratings.');
        if (result.promptFeedback) {
          console.error('[Google GenAI] Prompt Feedback:', JSON.stringify(result.promptFeedback, null, 2));
        }
        throw new Error('Gemini content generation failed due to safety policies.');
      }
    }

    // Ensure candidate.content and candidate.content.parts exist
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('[Google GenAI] No parts found in candidate content.');
      let responseText = "No text available in result.";
       try {
        // Try to access the text property if it exists
        if (result && 'text' in result) {
          responseText = String(result.text); // Access the text property directly
        }
      } catch (textError) {
        console.warn('[Google GenAI] Could not retrieve text from result:', textError);
      }
      console.error('[Google GenAI] Full response text (if any):', responseText);
      console.error('[Google GenAI] Full candidate object for debugging:', JSON.stringify(candidate, null, 2));
      throw new Error('No parts found in Gemini response candidate content.');
    }

    const part = candidate.content.parts[0] as Part;

    if (part.functionCall) {
      console.log('[Google GenAI] Function call found. Name:', part.functionCall.name);
      console.log('[Google GenAI] Function call args:', JSON.stringify(part.functionCall.args, null, 2));
      return part.functionCall.args;
    } else if (part.text) {
      console.warn('[Google GenAI] Gemini returned text instead of a function call. Attempting to parse as JSON.');
      console.log('[Google GenAI] Text received (first 500 chars):', part.text.substring(0, 500)); // Log more
      try {
        // It's possible the text isn't perfectly clean JSON and might be wrapped, e.g. in markdown code blocks
        let jsonText = part.text;
        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1];
          console.log('[Google GenAI] Extracted JSON from markdown block.');
        }
        const parsedText = JSON.parse(jsonText);
        console.log('[Google GenAI] Successfully parsed text as JSON.');
        return parsedText;
      } catch (e) {
        console.error('[Google GenAI] Failed to parse Gemini text response as JSON:', e);
        console.error('[Google GenAI] Raw text received that failed parsing:', part.text);
        if (toolName === 'create_slideshow_plan') {
          console.log('[Google GenAI] Generating mock slideshow plan due to text parsing error.');
          return generateMockSlideShowResponse();
        }
        throw new Error('Invalid JSON text response from Gemini and no function call.');
      }
    } else {
      console.error('[Google GenAI] Part does not contain functionCall or text.');
      console.error('[Google GenAI] Full part object for debugging:', JSON.stringify(part, null, 2));
      throw new Error('Gemini response part is empty or in an unexpected format.');
    }
  } catch (error) {
    console.error('[Google GenAI] Error during gemini.models.generateContent or response processing:', error);
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('[Google GenAI] Error message:', (error as Error).message);
      if ('stack' in error) console.error('[Google GenAI] Error stack:', (error as Error).stack);
      // Check for specific API error details if present
      if ('response' in error && (error as any).response) { // Type assertion
        console.error('[Google GenAI] Full API error response:', JSON.stringify((error as any).response, null, 2));
      }
    } else {
      console.error('[Google GenAI] Non-standard error object:', error);
    }

    if (toolName === 'create_slideshow_plan') {
      console.warn('[Google GenAI] Error occurred, falling back to mock slideshow plan.');
      return generateMockSlideShowResponse();
    }
    throw error;
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