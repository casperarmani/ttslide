'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ChevronLeft, ChevronRight, Clipboard, CheckCircle2 } from 'lucide-react';
import { SlideshowGeneration } from '@/lib/db';
import { Slideshow } from '@/lib/types';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const [generation, setGeneration] = useState<SlideshowGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlideshow, setActiveSlideshow] = useState(0);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [filteredSlideshows, setFilteredSlideshows] = useState<Slideshow[]>([]);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchGeneration = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/history/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Slideshow generation not found');
          }
          throw new Error(`Failed to fetch slideshow: ${response.statusText}`);
        }
        
        const data = await response.json();
        setGeneration(data);
        
        // Set initial theme filter to the first theme if available
        if (data.slideshows && data.slideshows.length > 0) {
          setActiveTheme(data.slideshows[0].theme);
        }
      } catch (err) {
        console.error('Error fetching slideshow:', err);
        setError(`Failed to load slideshow: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchGeneration();
  }, [id]);
  
  useEffect(() => {
    if (!generation || !generation.slideshows) return;
    
    if (activeTheme) {
      setFilteredSlideshows(generation.slideshows.filter(s => s.theme === activeTheme));
    } else {
      setFilteredSlideshows(generation.slideshows);
    }
  }, [generation, activeTheme]);
  
  // Function to download JSON
  const downloadJSON = () => {
    if (!generation) return;

    const json = JSON.stringify({ slideshows: generation.slideshows }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `slides-${id}.json`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to download all images from the current slideshow
  const downloadAllImages = async () => {
    if (!filteredSlideshows || filteredSlideshows.length === 0) return;

    const currentSlideshow = filteredSlideshows[activeSlideshow];
    if (!currentSlideshow || !currentSlideshow.images || currentSlideshow.images.length === 0) return;

    const theme = currentSlideshow.theme.replace(/\s+/g, '-').toLowerCase();

    // Download each image in sequence
    for (let i = 0; i < currentSlideshow.images.length; i++) {
      const imageUrl = currentSlideshow.images[i];
      const fileName = `${theme}-slideshow-${activeSlideshow + 1}-frame-${i + 1}.jpg`;

      try {
        // Fetch the image
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // Create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Add a small delay between downloads to prevent browser freezing
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to download image ${imageUrl}:`, error);
      }
    }
  };
  
  // Extract unique themes
  const themes = generation?.slideshows
    ? [...new Set(generation.slideshows.map(s => s.theme))]
    : [];

  // Function to copy caption to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCaption(text);
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedCaption(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center flex-wrap gap-y-2">
        <h1 className="text-xl md:text-2xl font-bold">Slideshow Preview</h1>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadAllImages}
            className="bg-blue-600 text-white px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg flex items-center gap-1 md:gap-2 hover:bg-blue-700"
            disabled={!filteredSlideshows || filteredSlideshows.length === 0}
          >
            <Download size={16} className="md:w-[18px] md:h-[18px]" />
            Download Images
          </button>

          <button
            onClick={downloadJSON}
            className="bg-black text-white px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-lg flex items-center gap-1 md:gap-2 hover:bg-gray-800"
            disabled={!generation}
          >
            <Download size={16} className="md:w-[18px] md:h-[18px]" />
            Download JSON
          </button>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-3 py-4 sm:p-4 max-w-5xl">
        {loading ? (
          <div className="text-center py-16">
            <p className="text-lg text-gray-600">Loading slideshow...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : !generation || !generation.slideshows || generation.slideshows.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-4">No slideshows found</h2>
            <p className="text-gray-600 mb-8">This generation doesn&apos;t contain any valid slideshows.</p>
            <Link
              href="/history"
              className="bg-black text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-gray-800"
            >
              Back to History
            </Link>
          </div>
        ) : (
          <>
            {/* Theme filter tabs */}
            <div className="mb-6 border-b">
              <div className="flex overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setActiveTheme(null)}
                  className={`px-3 py-2 text-sm md:text-base md:px-4 font-medium whitespace-nowrap ${
                    activeTheme === null
                      ? 'border-b-2 border-black'
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  All Themes
                </button>

                {themes.map(theme => (
                  <button
                    key={theme}
                    onClick={() => setActiveTheme(theme)}
                    className={`px-3 py-2 text-sm md:text-base md:px-4 font-medium whitespace-nowrap ${
                      activeTheme === theme
                        ? 'border-b-2 border-black'
                        : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Slideshows */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <div className="mb-4 flex flex-wrap justify-between items-center gap-y-2">
                <h2 className="text-lg md:text-xl font-semibold">
                  {activeTheme ? `${activeTheme} Theme` : 'All Slideshows'}
                  <span className="text-gray-500 ml-2 text-sm">
                    ({filteredSlideshows.length} slideshow{filteredSlideshows.length !== 1 ? 's' : ''})
                  </span>
                </h2>

                <div className="flex items-center text-sm">
                  <span className="mr-2">Slideshow:</span>
                  <span className="font-medium">{activeSlideshow + 1} / {filteredSlideshows.length}</span>
                </div>
              </div>
              
              {/* Swiper for slideshows */}
              <Swiper
                modules={[Navigation, Pagination]}
                spaceBetween={30}
                slidesPerView={1}
                navigation={{
                  prevEl: '.prev-slideshow',
                  nextEl: '.next-slideshow',
                }}
                pagination={{
                  clickable: true,
                  el: '.slideshow-pagination',
                }}
                onSlideChange={(swiper) => setActiveSlideshow(swiper.activeIndex)}
                className="mb-4"
              >
                {filteredSlideshows.map((slideshow, index) => (
                  <SwiperSlide key={index}>
                    <div>
                      <h3 className="text-lg font-medium mb-4">
                        {slideshow.theme} Slideshow #{index + 1}
                      </h3>
                      
                      {/* Mobile view for slideshow frames */}
                      <div className="sm:hidden">
                        {/* Mobile scroll hint */}
                        <div className="flex items-center justify-center text-gray-500 text-xs mb-2">
                          <span>← Swipe to view all frames →</span>
                        </div>

                        {/* Custom frame slider for mobile */}
                        <div className="relative">
                          {/* Frame counter */}
                          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full z-10">
                            <span id={`frame-counter-${index}`}>1/4</span>
                          </div>

                          {/* Mobile swiper - uses CSS scroll snap */}
                          <div
                            className="flex overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2"
                            onScroll={(e) => {
                              // Update frame counter on scroll
                              const container = e.currentTarget;
                              const scrollPos = container.scrollLeft;
                              const frameWidth = container.scrollWidth / slideshow.images.length;
                              const currentFrame = Math.min(
                                Math.floor(scrollPos / frameWidth) + 1,
                                slideshow.images.length
                              );
                              const counter = document.getElementById(`frame-counter-${index}`);
                              if (counter) {
                                counter.textContent = `${currentFrame}/${slideshow.images.length}`;
                              }
                            }}
                          >
                            {slideshow.images.map((image, imgIndex) => (
                              <div key={imgIndex} className="flex-shrink-0 min-w-[90vw] snap-start flex flex-col pr-2">
                                <div className="aspect-[9/16] relative rounded-lg overflow-hidden border mb-2">
                                  <Image
                                    src={image}
                                    alt={`Frame ${imgIndex + 1}`}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    sizes="90vw"
                                    priority={imgIndex === 0}
                                  />
                                </div>
                                <div className="flex items-center justify-center gap-1 group relative">
                                  <p className="text-sm text-center font-medium">
                                    {slideshow.captions[imgIndex]}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      copyToClipboard(slideshow.captions[imgIndex]);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-gray-100 opacity-100 flex items-center justify-center"
                                    aria-label="Copy caption"
                                    title="Copy caption"
                                  >
                                    {copiedCaption === slideshow.captions[imgIndex] ?
                                      <CheckCircle2 size={16} className="text-green-500" /> :
                                      <Clipboard size={16} className="text-gray-500" />
                                    }
                                  </button>
                                  {copiedCaption === slideshow.captions[imgIndex] && (
                                    <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-green-500 whitespace-nowrap">
                                      Copied!
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Desktop grid view - unchanged */}
                      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {slideshow.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="flex flex-col">
                            <div className="aspect-[9/16] relative rounded-lg overflow-hidden border mb-2">
                              <Image
                                src={image}
                                alt={`Frame ${imgIndex + 1}`}
                                fill
                                style={{ objectFit: 'cover' }}
                                sizes="(max-width: 768px) 50vw, 25vw"
                                priority={imgIndex === 0}
                              />
                            </div>
                            <div className="flex items-center justify-center gap-1 group relative">
                              <p className="text-sm text-center font-medium">
                                {slideshow.captions[imgIndex]}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  copyToClipboard(slideshow.captions[imgIndex]);
                                }}
                                className="p-1.5 rounded-full hover:bg-gray-100 opacity-100 flex items-center justify-center"
                                aria-label="Copy caption"
                                title="Copy caption"
                              >
                                {copiedCaption === slideshow.captions[imgIndex] ?
                                  <CheckCircle2 size={16} className="text-green-500" /> :
                                  <Clipboard size={16} className="text-gray-500" />
                                }
                              </button>
                              {copiedCaption === slideshow.captions[imgIndex] && (
                                <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-green-500 whitespace-nowrap">
                                  Copied!
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
              
              {/* Custom navigation */}
              <div className="flex items-center justify-between mt-6">
                <button className="prev-slideshow border rounded-full p-2 hover:bg-gray-50">
                  <ChevronLeft size={20} />
                </button>
                
                <div className="slideshow-pagination"></div>
                
                <button className="next-slideshow border rounded-full p-2 hover:bg-gray-50">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
        
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/history"
            className="border px-3 py-2 md:px-4 md:py-2 text-center sm:text-left rounded-lg flex items-center justify-center sm:justify-start gap-1 md:gap-2 hover:bg-gray-50"
          >
            <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />
            Back to History
          </Link>

          <Link
            href="/"
            className="border px-3 py-2 md:px-4 md:py-2 text-center sm:text-left rounded-lg flex items-center justify-center sm:justify-start gap-1 md:gap-2 hover:bg-gray-50 text-blue-600"
          >
            Upload New Images
          </Link>
        </div>
      </main>
    </div>
  );
}