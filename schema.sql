-- Table to store the results of each slideshow generation run
CREATE TABLE IF NOT EXISTS slideshow_generations (
    -- Use UUID for a unique, non-sequential ID
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Timestamp when the generation was saved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Store the settings used (prompts, themes, counts) as JSON
    -- Useful for debugging or displaying context later
    settings JSONB,

    -- Store the array of final Slideshow objects (with Blob URLs) as JSON
    -- JSONB is generally preferred in Postgres for indexing and querying JSON
    slideshows JSONB NOT NULL
);

-- Index for faster lookups by creation time (for the history list)
CREATE INDEX IF NOT EXISTS idx_slideshow_generations_created_at 
ON slideshow_generations(created_at DESC);