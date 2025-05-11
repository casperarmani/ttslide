'use client';

import { useState, useEffect } from 'react';
import { defaultPrompts } from '@/lib/prompts';
import Link from 'next/link';
import { UploadedFile } from '@/lib/types';
import { ArrowLeft, Play, Save, Settings } from 'lucide-react';

export default function SettingsPage() {
  const [orderingPrompt, setOrderingPrompt] = useState(defaultPrompts.ordering);
  const [captionPrompt, setCaptionPrompt] = useState(defaultPrompts.captions);
  const [researchText, setResearchText] = useState('');
  const [themes, setThemes] = useState<string[]>(defaultPrompts.themes);
  const [themesInput, setThemesInput] = useState(defaultPrompts.themes.join(', ')); // New state for raw text input
  const [slideshowsPerTheme, setSlideshowsPerTheme] = useState(defaultPrompts.slideshowsPerTheme);
  const [framesPerSlideshow, setFramesPerSlideshow] = useState(defaultPrompts.framesPerSlideshow);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  // Load uploaded files from localStorage
  useEffect(() => {
    const savedFiles = localStorage.getItem('uploadedFiles');
    if (savedFiles) {
      try {
        setUploadedFiles(JSON.parse(savedFiles));
      } catch (err) {
        console.error('Error parsing saved files:', err);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem('settings', JSON.stringify({
      orderingPrompt,
      captionPrompt,
      researchText,
      themes,
      themesInput,  // Save the raw input too
      slideshowsPerTheme,
      framesPerSlideshow
    }));

    // Show a temporary saved message
    const savedElement = document.getElementById('saved-message');
    if (savedElement) {
      savedElement.classList.remove('opacity-0');
      setTimeout(() => {
        savedElement.classList.add('opacity-0');
      }, 2000);
    }
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setOrderingPrompt(settings.orderingPrompt || defaultPrompts.ordering);
        setCaptionPrompt(settings.captionPrompt || defaultPrompts.captions);
        setResearchText(settings.researchText || '');
        setThemes(settings.themes || defaultPrompts.themes);
        // Load saved themesInput if available, otherwise create from themes array
        setThemesInput(settings.themesInput || settings.themes?.join(', ') || defaultPrompts.themes.join(', '));
        setSlideshowsPerTheme(settings.slideshowsPerTheme || defaultPrompts.slideshowsPerTheme);
        setFramesPerSlideshow(settings.framesPerSlideshow || defaultPrompts.framesPerSlideshow);
      } catch (err) {
        console.error('Error parsing saved settings:', err);
      }
    }
  }, []);

  // Generate slideshows
  const generateSlideshows = async () => {
    try {
      setGenerating(true);
      setError(null);
      setProgress(0);
      setProgressMessage('Starting batch processing');

      // Check if we have uploaded files
      if (!uploadedFiles.length) {
        setError('No uploaded files found. Please upload images first.');
        setGenerating(false);
        return;
      }

      console.log('Generating slideshows with user settings:', {
        themes,
        slideshowsPerTheme,
        framesPerSlideshow
      });

      // Call batch API with POST request
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt: orderingPrompt,
          captionPrompt,
          researchMarkdown: researchText,
          files: uploadedFiles,
          themes: themes,
          slideshowsPerTheme: slideshowsPerTheme,
          framesPerSlideshow
        }),
      });

      if (!response.ok) {
        let errorMsg = `Batch API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json(); // Try to parse structured error
          if (errorData && errorData.error) {
            errorMsg = `Batch API error: ${errorData.error}`;
          } else {
            const textError = await response.text(); // Fallback to text
            if (textError) errorMsg += ` - ${textError}`;
          }
        } catch (e) {
          // If parsing fails, use the text if possible or stick to status
          const textError = await response.text().catch(() => '');
          if (textError) errorMsg += ` - ${textError}`;
          console.error('Failed to parse error response from batch API', e);
        }
        throw new Error(errorMsg);
      }

      // Process the SSE stream directly from the response
      if (!response.body) {
        throw new Error('Response body is null. SSE stream cannot be established.');
      }

      // Process the SSE stream
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Stream finished, but completion should be handled by a 'complete' event
          if (progress < 100 && !error) {
            console.warn("SSE stream ended unexpectedly");
            setProgressMessage("Stream ended unexpectedly");
          }
          break;
        }

        const lines = value.split('\n\n');
        for (const lineBlock of lines) {
          if (!lineBlock.trim()) continue;

          let eventName = 'message'; // Default if no event name is specified
          let eventDataString = '';

          const eventLines = lineBlock.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              eventName = line.substring('event: '.length).trim();
            } else if (line.startsWith('data: ')) {
              eventDataString += line.substring('data: '.length).trim();
            }
          }

          if (eventDataString) {
            try {
              const data = JSON.parse(eventDataString);

              if (eventName === 'status') {
                setProgress(data.progress);
                setProgressMessage(data.message);
              } else if (eventName === 'complete') {
                setProgress(100);
                setProgressMessage('Batch processing complete. Redirecting...');

                // Save slideshows result
                localStorage.setItem('slideshows', JSON.stringify(data.slideshows));

                // Clear uploadedFiles to prevent stale Gemini file references
                // This ensures users will need to re-upload files for subsequent runs
                localStorage.removeItem('uploadedFiles');

                await reader.cancel(); // Gracefully cancel the reader
                window.location.href = '/slides';
                return;
              } else if (eventName === 'error') {
                console.error('SSE error event received:', data.message);
                setError(`Error during slideshow generation: ${data.message}`);
                await reader.cancel();
                setGenerating(false);
                return;
              }
            } catch (e) {
              console.error('Error parsing SSE JSON data:', eventDataString, e);
              setError(`Error parsing server response: ${(e as Error).message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(`Failed to generate slideshows: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex items-center gap-2">
          <span id="saved-message" className="text-green-600 transition-opacity duration-300 opacity-0">
            Settings saved!
          </span>
          <button
            onClick={saveSettings}
            className="border rounded-full p-2 hover:bg-gray-50"
            title="Save settings"
          >
            <Save size={18} />
          </button>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto p-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            Configuration
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Ordering System Prompt (for Gemini)
              </label>
              <textarea
                value={orderingPrompt}
                onChange={(e) => setOrderingPrompt(e.target.value)}
                className="w-full border rounded-lg p-3 min-h-[120px] font-mono text-sm"
                placeholder="Enter the system prompt for ordering slides..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Caption System Prompt (for Claude)
              </label>
              <textarea
                value={captionPrompt}
                onChange={(e) => setCaptionPrompt(e.target.value)}
                className="w-full border rounded-lg p-3 min-h-[120px] font-mono text-sm"
                placeholder="Enter the system prompt for generating captions..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Research Markdown (context for captions)
              </label>
              <textarea
                value={researchText}
                onChange={(e) => setResearchText(e.target.value)}
                className="w-full border rounded-lg p-3 min-h-[150px] font-mono text-sm"
                placeholder="Enter research text to inform caption generation..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Themes
                </label>
                <input
                  type="text"
                  value={themesInput}
                  onChange={(e) => {
                    // Update the raw input text
                    setThemesInput(e.target.value);
                    // Also update the themes array (for other parts of the app)
                    const newThemes = e.target.value.split(',').map(t => t.trim()).filter(t => t !== '');
                    setThemes(newThemes);
                  }}
                  onBlur={() => {
                    // Clean up the input when the field loses focus
                    const cleanedThemes = themes.filter(t => t.trim() !== '');
                    setThemes(cleanedThemes);
                    setThemesInput(cleanedThemes.join(', '));
                  }}
                  className="w-full border rounded-lg p-2"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Slideshows Per Theme
                </label>
                <input
                  type="number"
                  value={slideshowsPerTheme}
                  onChange={(e) => setSlideshowsPerTheme(Number(e.target.value))}
                  min="1"
                  max="30"
                  className="w-full border rounded-lg p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Frames Per Slideshow
                </label>
                <input
                  type="number"
                  value={framesPerSlideshow}
                  onChange={(e) => setFramesPerSlideshow(Number(e.target.value))}
                  min="2"
                  max="10"
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>
          </div>
          
          {/* File upload status */}
          <div className="mt-8 p-3 rounded-lg bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Uploaded Images</h3>
              <p className="text-sm text-gray-600">
                {uploadedFiles.length
                  ? `${uploadedFiles.length} images ready for processing`
                  : 'No images uploaded yet'}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Note: You'll need to re-upload images after each batch generation
              </p>
            </div>
            <Link href="/" className="text-blue-500 text-sm hover:underline">
              Upload more
            </Link>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {/* Progress bar */}
          {generating && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-1">
                <span>{progressMessage}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="mt-8 flex justify-between">
            <Link
              href="/"
              className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50"
            >
              <ArrowLeft size={18} />
              Back
            </Link>
            
            <button
              onClick={generateSlideshows}
              disabled={generating || !uploadedFiles.length}
              className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                'Processing...'
              ) : (
                <>
                  <Play size={18} />
                  Generate Slideshows
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}