'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  // Extract unique themes
  const themes = generation?.slideshows 
    ? [...new Set(generation.slideshows.map(s => s.theme))] 
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Slideshow Preview</h1>
        
        <button
          onClick={downloadJSON}
          className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800"
          disabled={!generation}
        >
          <Download size={18} />
          Download JSON
        </button>
      </header>
      
      <main className="flex-1 container mx-auto p-4 max-w-5xl">
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
            <p className="text-gray-600 mb-8">This generation doesn't contain any valid slideshows.</p>
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
              <div className="flex overflow-x-auto pb-2">
                <button
                  onClick={() => setActiveTheme(null)}
                  className={`px-4 py-2 font-medium whitespace-nowrap ${
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
                    className={`px-4 py-2 font-medium whitespace-nowrap ${
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
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold">
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
                      
                      {/* Inner slideshow with 4 frames */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {slideshow.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="flex flex-col">
                            <div className="aspect-[9/16] relative rounded-lg overflow-hidden border mb-2">
                              <Image
                                src={image}
                                alt={`Frame ${imgIndex + 1}`}
                                fill
                                style={{ objectFit: 'cover' }}
                              />
                            </div>
                            <p className="text-sm text-center font-medium">
                              {slideshow.captions[imgIndex]}
                            </p>
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
        
        <div className="mt-8 flex gap-4">
          <Link
            href="/history"
            className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            Back to History
          </Link>
          
          <Link
            href="/"
            className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 text-blue-600"
          >
            Upload New Images
          </Link>
        </div>
      </main>
    </div>
  );
}