'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Slideshow } from '@/lib/types';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function SlidesPage() {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [activeSlideshow, setActiveSlideshow] = useState(0);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [filteredSlideshows, setFilteredSlideshows] = useState<Slideshow[]>([]);
  
  // Load slideshows from localStorage
  useEffect(() => {
    const savedSlideshows = localStorage.getItem('slideshows');
    if (savedSlideshows) {
      try {
        const data = JSON.parse(savedSlideshows);
        setSlideshows(data);
        
        // Set initial theme filter to the first theme
        if (data.length > 0) {
          setActiveTheme(data[0].theme);
        }
      } catch (err) {
        console.error('Error parsing saved slideshows:', err);
      }
    }
  }, []);
  
  // Filter slideshows by theme
  useEffect(() => {
    if (activeTheme) {
      setFilteredSlideshows(slideshows.filter(s => s.theme === activeTheme));
    } else {
      setFilteredSlideshows(slideshows);
    }
  }, [slideshows, activeTheme]);
  
  // Function to download JSON
  const downloadJSON = () => {
    const json = JSON.stringify({ slideshows }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slides.json';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Get unique themes
  const themes = [...new Set(slideshows.map(s => s.theme))];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Slideshow Preview</h1>
        
        <button
          onClick={downloadJSON}
          className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800"
        >
          <Download size={18} />
          Download JSON
        </button>
      </header>
      
      <main className="flex-1 container mx-auto p-4 max-w-5xl">
        {slideshows.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-4">No slideshows found</h2>
            <p className="text-gray-600 mb-8">Generate slideshows from the settings page first.</p>
            <Link
              href="/settings"
              className="bg-black text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-gray-800"
            >
              Go to Settings
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
        
        <div className="mt-8 flex flex-col md:flex-row items-start md:items-center gap-4">
          <Link
            href="/settings"
            className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            Back to Settings
          </Link>

          <Link
            href="/"
            className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 text-blue-600"
          >
            <Upload size={18} />
            Upload New Images
          </Link>

          <p className="text-sm text-amber-600">
            Note: To generate more slideshows, you&apos;ll need to upload new images first
          </p>
        </div>
      </main>
    </div>
  );
}