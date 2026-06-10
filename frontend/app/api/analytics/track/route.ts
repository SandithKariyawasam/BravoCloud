import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // We need to forward the body, and importantly, the headers (especially User-Agent and real IP/Country headers)
    const body = await request.text(); // Use text instead of json in case of beacon parsing differences
    
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
    
    // Forward crucial headers for analytics
    const ua = request.headers.get('user-agent');
    if (ua) headers.set('user-agent', ua);
    
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');
    if (country) headers.set('x-vercel-ip-country', country);
    
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

    const response = await fetch(`${backendUrl}/api/analytics/track`, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      return new NextResponse('Error forwarding tracking event', { status: response.status });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Proxy Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
