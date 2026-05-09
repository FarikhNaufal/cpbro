<script>
  import Sparkline from './Sparkline.svelte';
  
  let { signal, apiData, btcScore = 0 } = $props();
  
  let copiedCard = $state(false);

  function getSignalColor(sig) {
    if (sig.includes('LONG')) return 'var(--accent-green)';
    if (sig.includes('SHORT')) return 'var(--accent-red)';
    return 'var(--text-main)';
  }

  async function copySignalJson() {
    if (!apiData) return;
    try {
      const payload = {
        market_sentiment: apiData.market_sentiment,
        btc_trend: apiData.btc_trend,
        btc_strength_score: apiData.btc_strength_score,
        market_volatility: apiData.market_volatility,
        long_signals: apiData.long_signals,
        short_signals: apiData.short_signals,
        generated_at: apiData.generated_at,
        signal: signal
      };
      await navigator.clipboard.writeText(JSON.stringify(payload));
      copiedCard = true;
      setTimeout(() => copiedCard = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  // --- TRAFFIC LIGHT SNIPER LOGIC ---
  let isLong = $derived(signal.signal.includes('LONG'));

  let mfiColorClass = $derived.by(() => {
    if (signal.mfi_15m >= 40 && signal.mfi_15m <= 60) return 'text-slate-500';
    if (isLong && signal.mfi_15m < 30) return 'text-emerald-400 glow-emerald';
    if (!isLong && signal.mfi_15m > 70) return 'text-emerald-400 glow-emerald';
    if (isLong && signal.mfi_15m >= 30) return 'text-amber-500';
    if (!isLong && signal.mfi_15m <= 70) return 'text-amber-500';
    return 'text-slate-500';
  });

  let rsiColorClass = $derived.by(() => {
    if (signal.rsi_15m >= 40 && signal.rsi_15m <= 60) return 'text-slate-500';
    if (isLong && signal.rsi_15m < 35) return 'text-emerald-400 glow-emerald';
    if (!isLong && signal.rsi_15m > 75) return 'text-emerald-400 glow-emerald';
    if (isLong && signal.rsi_15m >= 35) return 'text-amber-500';
    if (!isLong && signal.rsi_15m <= 75) return 'text-amber-500';
    return 'text-slate-500';
  });

  let fundingColorClass = $derived.by(() => {
    if (isLong && signal.funding_rate < 0) return 'text-emerald-400 glow-emerald';
    if (!isLong && signal.funding_rate > 0) return 'text-emerald-400 glow-emerald';
    return '';
  });

  let confidenceColorClass = $derived.by(() => {
    if (signal.confidence > 80) return 'text-emerald-400';
    if (signal.confidence >= 50) return 'text-amber-500';
    return 'text-rose-400';
  });

  let isDangerTrend = $derived(signal.adx_15m > 45);
  let isAntiShort = $derived(!isLong && btcScore >= 8);

  let btcFilterOk = $derived(isLong ? signal.btc_filter.toLowerCase().includes('bull') : signal.btc_filter.toLowerCase().includes('bear'));

  let masterStatus = $derived.by(() => {
    if (isDangerTrend) return { text: 'DANGER: TRENDING', bg: 'bg-rose-600', pulse: false };
    
    const rsiReady = isLong ? signal.rsi_15m < 35 : signal.rsi_15m > 75;
    const mfiReady = isLong ? signal.mfi_15m < 30 : signal.mfi_15m > 70;
    const rsiNeutral = signal.rsi_15m >= 40 && signal.rsi_15m <= 60;
    const mfiNeutral = signal.mfi_15m >= 40 && signal.mfi_15m <= 60;

    if (rsiReady && mfiReady && btcFilterOk) {
      return { text: 'EXECUTE TARGET', bg: 'bg-emerald-600', pulse: false };
    }
    
    if (rsiNeutral || mfiNeutral) {
      return { text: "NO MAN'S LAND", bg: 'bg-slate-600', pulse: false };
    }

    return { text: 'STALKING...', bg: 'bg-amber-600', pulse: false };
  });

</script>

<div class="signal-card glass-panel">
  
  <!-- Master Status Badge -->
  <div class="master-status {masterStatus.bg}">
    STATUS: {masterStatus.text}
  </div>

  <!-- Card Header -->
  <div class="card-header">
    <div class="symbol-info">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
        <h3 style="margin: 0;">{signal.symbol}</h3>
        <button class="card-copy-btn" onclick={copySignalJson} title="Copy JSON">
          {#if copiedCard}
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" class="success-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          {/if}
        </button>
      </div>
      {#if isAntiShort}
        <span class="signal-badge anti-short-badge">
          DO NOT SHORT (BTC 8+)
        </span>
      {:else}
        <span class="signal-badge" style="background: {getSignalColor(signal.signal)}20; color: {getSignalColor(signal.signal)}; border: 1px solid {getSignalColor(signal.signal)}40">
          {signal.signal.replace('_', ' ')}
        </span>
      {/if}
    </div>
    <div class="price-info">
      <span class="last-price">${signal.last_price.toFixed(4)}</span>
      <span class="price-change {signal.price_change_24h >= 0 ? 'positive' : 'negative'}">
        {signal.price_change_24h >= 0 ? '+' : ''}{signal.price_change_24h}%
      </span>
    </div>
  </div>

  <div class="chart-metrics-wrapper">
    <!-- Sparkline Chart -->
    <div class="chart-container">
        <Sparkline data={signal.raw_klines} width={400} height={80} />
    </div>

    <!-- Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric">
        <span class="label">Confidence</span>
        <span class="value confidence-value {confidenceColorClass}">{signal.confidence}%</span>
      </div>
      <div class="metric">
        <span class="label">Score</span>
        <span class="value">{signal.score}/10</span>
      </div>
      <div class="metric">
        <span class="label">Structure</span>
        <span class="value truncate" title="{signal.market_structure.description}">{signal.market_structure.description}</span>
      </div>
      <div class="metric">
        <span class="label">Volume Spike</span>
        <span class="value {signal.volume_spike ? 'positive' : ''}">{signal.volume_spike ? 'Yes' : 'No'}</span>
      </div>
    </div>
  </div>

  <!-- Indicators & Liquidation (Moved UP) -->
  <div class="advanced-metrics">
    <div class="metrics-column">
      <div class="small-metric"><span>RSI:</span> <span class="{rsiColorClass} font-bold">{signal.rsi_15m}</span></div>
      <div class="small-metric"><span>MFI:</span> <span class="{mfiColorClass} font-bold">{signal.mfi_15m}</span></div>
      <div class="small-metric"><span>ADX:</span> <span>{signal.adx_15m}</span></div>
    </div>
    <div class="metrics-column">
      <div class="small-metric"><span>Funding:</span> <span class="{fundingColorClass} font-bold">{(signal.funding_rate * 100).toFixed(4)}%</span></div>
      <div class="small-metric"><span>Liq Upper:</span> <span>${signal.liquidation_levels.upper_cluster}</span></div>
      <div class="small-metric"><span>Liq Lower:</span> <span>${signal.liquidation_levels.lower_cluster}</span></div>
    </div>
  </div>

  {#if isDangerTrend}
    <div class="danger-overlay-text">⚠️ STRONG TREND - DO NOT COUNTER</div>
  {/if}
</div>

<style>
  /* Tailwind Utility Clones */
  .text-emerald-400 { color: #34d399 !important; }
  .text-amber-500 { color: #f59e0b !important; }
  .text-slate-500 { color: #64748b !important; }
  .text-rose-600 { color: #e11d48 !important; }
  .text-rose-400 { color: #fb7185 !important; }
  .bg-emerald-600 { background-color: rgba(5, 150, 105, 0.2) !important; color: #34d399 !important; border-bottom: 1px solid #059669 !important; }
  .bg-amber-600 { background-color: rgba(217, 119, 6, 0.2) !important; color: #f59e0b !important; border-bottom: 1px solid #d97706 !important; }
  .bg-slate-600 { background-color: rgba(71, 85, 105, 0.2) !important; color: #cbd5e1 !important; border-bottom: 1px solid #475569 !important; }
  .bg-rose-600 { background-color: rgba(225, 29, 72, 0.2) !important; color: #fb7185 !important; border-bottom: 1px solid #e11d48 !important; }
  .font-bold { font-weight: 700 !important; }

  .glow-emerald {
    text-shadow: 0 0 10px rgba(52, 211, 153, 0.6);
  }

  .danger-overlay-text {
    width: calc(100% + 2rem);
    margin: 1rem -1rem -1rem -1rem;
    background-color: rgba(225, 29, 72, 0.2);
    color: #fb7185;
    border-top: 1px solid rgba(225, 29, 72, 0.4);
    text-align: center;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.35rem;
    letter-spacing: 0.05em;
  }

  .master-status {
    width: calc(100% + 2rem);
    margin: -1rem -1rem 0.5rem -1rem;
    padding: 0.35rem;
    text-align: center;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.1em;
  }
  
  .anti-short-badge {
    background: rgba(225, 29, 72, 0.2) !important;
    color: #e11d48 !important;
    border: 1px solid rgba(225, 29, 72, 0.5) !important;
  }

  /* Signal Card */
  .signal-card {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    overflow: hidden;
  }

  /* Decorative glowing orb */
  .signal-card::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 100px;
    height: 100px;
    background: var(--accent-red);
    filter: blur(60px);
    opacity: 0.15;
    border-radius: 50%;
    pointer-events: none;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .symbol-info h3 {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .card-copy-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .card-copy-btn:hover {
    color: var(--accent-blue);
    background: rgba(255, 255, 255, 0.05);
  }

  .card-copy-btn .success-icon {
    color: var(--accent-green);
  }

  .signal-badge {
    display: inline-block;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .price-info {
    text-align: right;
  }

  .last-price {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .price-change {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .price-change.positive { color: var(--accent-green); }
  .price-change.negative { color: var(--accent-red); }

  .chart-metrics-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chart-container {
    margin: 0;
    height: 60px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Metrics Grid */
  .metrics-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric .label {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .metric .value {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .confidence-value {
    color: var(--accent-purple);
  }

  .positive { color: var(--accent-green) !important; }
  .negative { color: var(--accent-red) !important; }
  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Advanced Metrics */
  .advanced-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(0,0,0,0.15);
    padding: 0.75rem;
    border-radius: 8px;
  }

  .small-metric {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .small-metric span:last-child {
    font-weight: 500;
    color: var(--text-main);
  }

  @media (max-width: 768px) {
    .signal-card {
      padding: 1rem;
      gap: 1rem;
      border-radius: 12px;
    }

    .chart-metrics-wrapper {
      flex-direction: row;
      align-items: center;
      gap: 1rem;
    }

    .chart-container {
      width: 45%;
      height: 70px;
    }

    .metrics-grid {
      width: 55%;
      gap: 0.75rem;
      padding: 0;
      background: transparent;
    }

    .metric .label {
      font-size: 0.65rem;
    }

    .metric .value {
      font-size: 0.85rem;
    }

  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
