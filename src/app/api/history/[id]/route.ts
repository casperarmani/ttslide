import { NextRequest, NextResponse } from 'next/server';
import { getGenerationById } from '@/lib/db';

// Route handler for /api/history/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Use awaited params to satisfy Next.js warning
  const { id } = await Promise.resolve(params);

  if (!id) {
    return NextResponse.json(
      { error: 'Missing generation ID' },
      { status: 400 }
    );
  }

  // Basic UUID validation
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
    return NextResponse.json(
      { error: 'Invalid generation ID format' },
      { status: 400 }
    );
  }

  try {
    const generation = await getGenerationById(id);
    
    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(generation);
  } catch (error) {
    console.error(`Failed to fetch generation ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch generation' },
      { status: 500 }
    );
  }
}