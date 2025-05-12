import { createPool } from '@vercel/postgres';
import { Slideshow } from './types';

// Check if DATABASE_URL is set, and if not, log an error
if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  // Optionally, throw an error to prevent the application from starting without it
  // throw new Error("FATAL ERROR: DATABASE_URL environment variable is not set.");
}

const pool = createPool({
  connectionString: process.env.DATABASE_URL,
});

// Export the pool if direct client access is ever needed
export { pool };

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
    if (!pool) throw new Error("Database pool is not initialized.");
    const { rows, rowCount } = await pool.sql<SlideshowGeneration>`
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
    if (!pool) throw new Error("Database pool is not initialized.");
    const { rows } = await pool.sql<SlideshowGenerationSummary>`
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
    if (!pool) throw new Error("Database pool is not initialized.");
    const result = await pool.sql`
      INSERT INTO slideshow_generations (settings, slideshows)
      VALUES (${JSON.stringify(settings)}::jsonb, ${JSON.stringify(slideshows)}::jsonb)
      RETURNING id;
    `;
    // Ensure result.rows[0] and result.rows[0].id exist before accessing
    if (result.rows && result.rows.length > 0 && result.rows[0].id) {
        return result.rows[0].id;
    } else {
        throw new Error("Failed to save generation or retrieve ID.");
    }
  } catch (error) {
    console.error("Failed to save generation:", error);
    throw error;
  }
}