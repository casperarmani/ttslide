# TikTok Slideshow Generator

A Next.js web application that turns image folders into fully-ordered TikTok slideshows in one click. This app uses AI to organize images and generate captions following a four-frame narrative structure.

## Features

- Upload three folders of images (face, faceless, product) 
- AI-powered image ordering with Google Gemini
- AI-generated captions with Claude Sonnet
- Real-time progress tracking
- Customizable system prompts and settings
- Preview slideshows with Swiper carousel
- Export JSON manifest for external video creation

## Project Structure

- `/src/app` - Next.js App Router pages
- `/src/app/api` - API endpoints (upload, order, caption, batch)
- `/src/lib` - Helper functions, types, and prompts
- `/public/uploads` - Uploaded image storage

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment variables example file:
   ```bash
   cp .env.example .env
   ```
4. Add your API keys to the `.env` file:
   - `GEMINI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/)
   - `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)

5. Run the development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload Images**:
   - Drag and drop three folders into the browser (face, faceless, product)
   - Click "Upload & Continue"

2. **Configure Settings**:
   - Customize system prompts for ordering and captions
   - Add research text for context
   - Adjust themes and settings if needed
   - Click "Generate Slideshows"

3. **Preview Results**:
   - Browse through slideshows by theme
   - View the 4-frame structure with captions
   - Download JSON manifest for external video creation

## API Endpoints

- `/api/upload` - Handles image uploads and Gemini file registration
- `/api/order` - Uses Gemini to organize images into slideshow sequences
- `/api/caption` - Uses Claude to generate captions for each slideshow
- `/api/batch` - Orchestrates the entire process with SSE progress updates

## Technologies

- Next.js 15 (App Router)
- TypeScript
- Google Gemini AI
- Anthropic Claude AI
- Swiper.js
- TailwindCSS

## License

MIT