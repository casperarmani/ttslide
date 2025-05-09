// Default prompt templates for AI models

export const defaultPrompts = {
  // Ordering system prompt for Gemini
  ordering: `Your role is to act as a creative director. Organize the provided images into slideshows.
Each slideshow must have 4 images.
The slideshows should be grouped by theme. The themes are: "PMS" (with a focus on mood swings for girls, which will inform the captions later), "insomnia", and "anxiety".
All slideshows you design must match the aesthetic/vibe of their respective themes and flow together cohesively.
Prioritize using a diverse range of images, but you can reuse images across different slideshows if necessary to meet the required number of slideshows per theme, ensuring they still fit the aesthetic and flow.
Think very long and hard about the combinations. Once you have a plan, review it to ensure all slideshows flow well internally and within their theme.
Your task is to create this plan by outputting the image IDs in the proper order/sequence you've assigned for each slideshow. You are not generating the actual slideshow video or captions.
The output format will be a JSON structure as defined by the 'create_slideshow_plan' tool, which you will be instructed to use.`,

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
        minItems: 1,  // Support at least 1 slideshow
        maxItems: 30  // Support up to 30 slideshows (3 themes x 10 per theme)
      }
    },
    required: ['slideshows']
  }
};