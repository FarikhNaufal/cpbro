export async function load({ fetch }) {
  const baseUrl = 'https://api.farikh.my.id/v1/crypto-bro';
  
  try {
    const [marketRes, historyRes] = await Promise.all([
      fetch(`${baseUrl}/analyze-market-v2`),
      fetch(`${baseUrl}/history`)
    ]);
    
    const marketJson = await marketRes.json();
    const historyJson = await historyRes.json();
    
    return {
      apiData: marketJson.data,
      historyData: historyJson.data || [],
      error: null
    };
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return {
      apiData: null,
      historyData: [],
      error: error.message
    };
  }
}
