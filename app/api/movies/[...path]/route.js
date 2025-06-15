import { NextResponse } from 'next/server';
const API_BASE_URL = 'https://phimapi.com';

export async function GET(request, { params }) {
  const { path } = params;
  const searchParams = new URL(request.url).searchParams;
  const query = Object.fromEntries(searchParams);
  const url = `${API_BASE_URL}/${path.join('/')}?${new URLSearchParams(query).toString()}`;

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`API error for ${url}: ${error.message}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
