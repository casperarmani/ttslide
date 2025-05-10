// Types for the TikTok Slideshow Generator

// Uploaded file information
export interface UploadedFile {
  kind: 'face' | 'faceless' | 'product';
  localUrl: string;  // URL to access the file from the browser
  geminiFileIdentifier: string;  // Gemini File API identifier (name)
  geminiFileUri?: string;        // The URI returned by Gemini File API (if available)
  mime: string;      // MIME type
  originalName?: string; // Original filename
}

// Input for ordering API
export interface OrderRequest {
  systemPrompt: string;
  files: UploadedFile[];
  themes?: string[];
  slideshowsPerTheme?: number;
  framesPerSlideshow?: number;
}

// Ordered slideshow from Gemini
export interface OrderedSlideshow {
  theme: string;
  images: string[]; // Array of Gemini file IDs
}

// Gemini ordering response
export interface OrderResponse {
  slideshows: OrderedSlideshow[];
}

// Input for caption API
export interface CaptionRequest {
  slide: {
    theme: string;
    images: string[]; // Array of local URLs
  };
  research: string;
  systemPrompt: string;
}

// Caption API response
export interface CaptionResponse {
  captions: string[];
}

// Complete slideshow with images and captions
export interface Slideshow {
  theme: string;
  images: string[]; // Array of local URLs
  captions: string[];
}

// Batch API request
export interface BatchRequest {
  systemPrompt: string;
  researchMarkdown: string;
  captionPrompt: string;
  files: UploadedFile[];
  themes?: string[];
  slideshowsPerTheme?: number;
  framesPerSlideshow?: number;
}

// Final response from batch API
export interface BatchResponse {
  slideshows: Slideshow[];
}

// Server-sent event status update
export interface StatusUpdate {
  type: 'status';
  message: string;
  progress: number; // 0-100
}

// Server-sent event completion
export interface CompletionUpdate {
  type: 'complete';
  data: BatchResponse;
}