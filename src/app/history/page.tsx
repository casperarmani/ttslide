'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, History } from 'lucide-react';
import { SlideshowGenerationSummary } from '@/lib/db';

export default function HistoryPage() {
  const [generations, setGenerations] = useState<SlideshowGenerationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGenerations = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/history');
        
        if (!response.ok) {
          throw new Error(`History fetch failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        setGenerations(data);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError(`Failed to load slideshow history: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchGenerations();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-1 md:gap-2">
          <History size={20} className="md:w-6 md:h-6" />
          Slideshow History
        </h1>
      </header>
      
      <main className="flex-1 container mx-auto px-3 py-4 sm:p-4 max-w-4xl">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">Loading slideshow history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">No slideshows found</h2>
            <p className="text-gray-600 mb-8">Generate slideshows from the upload page to see them here.</p>
            <Link
              href="/"
              className="bg-black text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-gray-800"
            >
              Upload Images
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Your Slideshow Generations</h2>
            <div className="divide-y">
              {generations.map(generation => (
                <Link
                  key={generation.id}
                  href={`/history/${generation.id}`}
                  className="py-4 px-2 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50 rounded transition-colors"
                >
                  <div>
                    <div className="font-medium break-words">
                      {generation.themes && Array.isArray(generation.themes)
                        ? generation.themes.join(', ')
                        : 'Untitled Generation'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(generation.created_at.toString())}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <span className="text-sm text-gray-500">
                      {generation.slideshow_count} slideshows
                    </span>
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-8">
          <Link
            href="/"
            className="border px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            Back to Upload
          </Link>
        </div>
      </main>
    </div>
  );
}