import { NextRequest, NextResponse } from 'next/server';
import { listGenerations } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get the list of generations from the database
    const generations = await listGenerations();
    
    return NextResponse.json(generations);
  } catch (error) {
    console.error("Failed to fetch history list:", error);
    return NextResponse.json(
      { error: 'Failed to fetch history list' },
      { status: 500 }
    );
  }
}