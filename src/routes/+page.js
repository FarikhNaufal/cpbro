export async function load({ fetch }) {
  try {
    const response = await fetch('https://api.farikh.my.id/v1/crypto-bro/analyze-market-v2', {
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const result = await response.json();
    
    // Asumsi response format: { status: 200, data: { ... } }
    return {
      apiData: result.data,
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
