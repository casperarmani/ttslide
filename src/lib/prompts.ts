// Default prompt templates for AI models

export const defaultPrompts = {
  // Ordering system prompt for Gemini
  ordering: `You are a creative director for TikTok. Themes: PMS, Insomnia, Anxiety. 
Sequence per slideshow: face → faceless → faceless → product.
Return JSON that exactly matches the slideshows schema.`,

  // Caption system prompt for Claude
  captions: `You are a DTC copywriter. For each of the 4 frames write one overlay caption (max 8 words) following PAS: pain, twist, dream, CTA. Use research text for insight.
Return JSON {"captions":["…","…","…","…"]} only.`,

  // Default themes
  themes: ['PMS', 'Insomnia', 'Anxiety'],
  
  // Default frames per slideshow
  framesPerSlideshow: 4,
  
  // Default number of slideshows per theme
  slideshowsPerTheme: 10
};

// Slideshows schema for Gemini function/tool
export const slideshowsSchema = {
  name: 'create_slideshow_plan',
  description: 'Create a plan for TikTok slideshows based on image folders',
  parameters: {
    type: 'object',
    properties: {
      slideshows: {
        type: 'array',
        description: 'Array of slideshow objects organized by theme',
        items: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: 'Theme of the slideshow (PMS, Insomnia, Anxiety)',
              enum: ['PMS', 'Insomnia', 'Anxiety'],
            },
            images: {
              type: 'array',
              description: 'Array of image IDs in sequence: face → faceless → faceless → product',
              items: {
                type: 'string',
                description: 'Image ID'
              },
              minItems: 4,
              maxItems: 4
            }
          },
          required: ['theme', 'images']
        },
        minItems: 30,
        maxItems: 30
      }
    },
    required: ['slideshows']
  }
};