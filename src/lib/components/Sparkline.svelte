<script>
  let { 
    data = [], 
    width = 200, 
    height = 60, 
    color = "#10b981", // Default green
    fillOpacity = 0.2 
  } = $props();

  // Process klines (which have 'c' for close price)
  let prices = $derived(data.map(d => d.c));
  let minPrice = $derived(Math.min(...prices));
  let maxPrice = $derived(Math.max(...prices));
  let range = $derived(maxPrice - minPrice || 1); // Prevent division by zero

  // Generate SVG path coordinates
  let points = $derived(prices.map((price, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((price - minPrice) / range) * height;
    return `${x},${y}`;
  }));

  let linePath = $derived(`M ${points.join(' L ')}`);
  // Create a closed path for the gradient fill
  let areaPath = $derived(`${linePath} L ${width},${height} L 0,${height} Z`);

  // Determine color based on first and last close
  let isBullish = $derived(prices[prices.length - 1] >= prices[0]);
  let themeColor = $derived(isBullish ? '#10b981' : '#ef4444'); // Green if up, Red if down
  let activeColor = $derived(color !== '#10b981' ? color : themeColor);
  
  // Create unique ID for gradient
  const gradientId = `sparkline-gradient-${Math.random().toString(36).substring(2, 9)}`;
</script>

<svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" class="sparkline">
  <defs>
    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color={activeColor} stop-opacity={fillOpacity} />
      <stop offset="100%" stop-color={activeColor} stop-opacity="0" />
    </linearGradient>
  </defs>
  
  <!-- Fill Area -->
  <path
    d={areaPath}
    fill={`url(#${gradientId})`}
    class="sparkline-area"
  />
  
  <!-- Line -->
  <path
    d={linePath}
    fill="none"
    stroke={activeColor}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="sparkline-line"
  />
</svg>

<style>
  .sparkline {
    overflow: visible;
  }
  .sparkline-line {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
</style>
