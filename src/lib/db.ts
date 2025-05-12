import { createPool } from '@vercel/postgres';
import { Slideshow } from './types';

// Create a SQL client with the specific environment variable
const sql = createPool({
  connectionString: process.env.DATABASE_URL
});

// Export the sql client for use in API routes
export { sql };

// Types for the database models
export interface SlideshowGeneration {
  id: string;
  created_at: Date;
  settings: {
    systemPrompt?: string;
    captionPrompt?: string;
    researchMarkdown?: string;
    themes: string[];
    slideshowsPerTheme: number;
    framesPerSlideshow: number;
  };
  slideshows: Slideshow[];
}

// Type for use in the API routes and elsewhere
export interface SlideshowGenerationSummary {
  id: string;
  created_at: Date;
  themes: string[] | null;
  slideshow_count: number;
}

// Helper functions for common database operations
export async function getGenerationById(id: string): Promise<SlideshowGeneration | null> {
  try {
    const { rows, rowCount } = await sql<SlideshowGeneration>`
      SELECT id, created_at, settings, slideshows
      FROM slideshow_generations
      WHERE id = ${id};
    `;

    if (rowCount === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error(`Failed to fetch generation ${id}:`, error);
    throw error;
  }
}

export async function listGenerations(): Promise<SlideshowGenerationSummary[]> {
  try {
    const { rows } = await sql<SlideshowGenerationSummary>`
      SELECT 
        id, 
        created_at, 
        settings->'themes' AS themes, 
        jsonb_array_length(slideshows) AS slideshow_count
      FROM slideshow_generations
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    return rows;
  } catch (error) {
    console.error("Failed to fetch generations list:", error);
    throw error;
  }
}

export async function saveGeneration(
  settings: SlideshowGeneration['settings'], 
  slideshows: Slideshow[]
): Promise<string> {
  try {
    const result = await sql`
      INSERT INTO slideshow_generations (settings, slideshows)
      VALUES (${JSON.stringify(settings)}::jsonb, ${JSON.stringify(slideshows)}::jsonb)
      RETURNING id;
    `;
    return result.rows[0].id;
  } catch (error) {
    console.error("Failed to save generation:", error);
    throw error;
  }
}