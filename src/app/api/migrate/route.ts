import { NextRequest, NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

// Create a direct connection to the database using the DATABASE_URL
const sql = createPool({
  connectionString: process.env.DATABASE_URL
});

export async function GET(request: NextRequest) {
  try {
    // Log environment variables (but mask sensitive parts)
    console.log('Environment variables:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set (value hidden)' : 'Not set',
      NODE_ENV: process.env.NODE_ENV
    });

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL environment variable is not set'
      }, { status: 500 });
    }

    // Read schema SQL file
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await sql.query(statement + ';');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database migrations applied successfully',
      statements: statements.length
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to apply migrations: ${(error as Error).message}`
      },
      { status: 500 }
    );
  }
}