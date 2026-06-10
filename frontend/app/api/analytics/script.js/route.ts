import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // Fetch the script from the secure backend
    const response = await fetch(`${backendUrl}/api/analytics/script.js`);
    
    if (!response.ok) {
      return new NextResponse('Error loading script', { status: response.status });
    }
    
    let scriptContent = await response.text();
    
    // Rewrite the endpoint inside the script to point to this frontend proxy
    // The original script has: var endpoint = 'BACKEND_URL/api/analytics/track';
    // We want it to use the frontend's domain.
    const url = new URL(request.url);
    const frontendEndpoint = `${url.origin}/api/analytics/track`;
    
    // We can replace the endpoint line dynamically
    scriptContent = scriptContent.replace(
      /var endpoint = '.*?\/api\/analytics\/track';/,
      `var endpoint = '${frontendEndpoint}';`
    );

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
