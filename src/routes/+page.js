import { PUBLIC_API_HOST } from '$env/static/public';

export async function load({ fetch }) {
  const baseUrl = PUBLIC_API_HOST;
  
  try {
    const marketRes = await fetch(`${baseUrl}/analyze-market-v2`);
    const marketJson = await marketRes.json();
    
    return {
      apiData: marketJson.data,
      error: null
    };
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return {
      apiData: null,
      error: error.message
    };
  }
}
