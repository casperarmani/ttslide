// Default prompt templates for AI models

export const defaultPrompts = {
  // Ordering system prompt for Gemini
  ordering: `organize all of these in slideshows, they all must match the aesthetic/vibe and flow together. 4 pics per slide. You must use every slide, and have multiple combinations. We are looking for 30 slides total. We will divide them by theme, the first general them for slides will be "PMS" and mood swings for girls (thats what the caption overlays will be, the second will be insomnia, and the third will be anxiety. These are the 3 themes for the slideshows, you will make 10 per theme, so 30 total using the slides available to you. Think very long and hard of the combinations and when you are finally done review them to make sure they all flow together. You will output each slide back to me in the proper order/sequence you assigned it to. You are not actually making the slideshow, just sending back the images in the proper order/sequence. You can Reuse some images across different slides to reach 30 slides if there are not enough images, as long as they flow with the aesthetic and match.`,

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