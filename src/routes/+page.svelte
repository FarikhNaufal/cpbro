<script>
import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { slide } from 'svelte/transition';
  import SignalCard from "$lib/components/SignalCard.svelte";
  import { PUBLIC_API_HOST } from '$env/static/public';

  let { data } = $props();
  let apiData = $derived(data.apiData);
  let errorMsg = $derived(data.error);
  
  let executeSignals = $derived(apiData?.execute_signals || []);
  let geminiWatchlist = $derived(apiData?.gemini_watchlist || []);
  let localWatchlist = $derived(apiData?.local_watchlist || []);
  let rejectedSignals = $derived(apiData?.rejected_signals || []);

  // Format date
  let generatedAt = $derived(apiData ? new Date(apiData.generated_at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }) : '');

  function getSentimentColor(sentiment) {
    if (!sentiment) return 'var(--text-main)';
    if (sentiment.toLowerCase().includes('bull') || sentiment.toLowerCase().includes('risk on')) return 'var(--accent-green)';
    if (sentiment.toLowerCase().includes('bear') || sentiment.toLowerCase().includes('risk off')) return 'var(--accent-red)';
    return 'var(--accent-orange)';
  }

  let currentTime = $state('');
  let copied = $state(false);
  let showToast = $state(false);
  let isRefreshing = $state(false);
  let lastFetchedMinute = -1;
  let activeTab = $state('execute'); // execute, gemini, local, rejected, history

  let historyData = $state([]);
  let isFetchingHistory = $state(false);
  let hasFetchedHistory = $state(false);

  $effect(() => {
    if (activeTab === 'history' && !hasFetchedHistory && !isFetchingHistory) {
      fetchHistory();
    }
  });

  async function fetchHistory() {
    isFetchingHistory = true;
    try {
      const res = await fetch(`${PUBLIC_API_HOST}/history`);
      const json = await res.json();
      historyData = json.data || [];
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      isFetchingHistory = false;
      hasFetchedHistory = true;
    }
  }

  async function handleRefresh() {
    isRefreshing = true;
    try {
      if (activeTab === 'history') {
        await fetchHistory();
      } else {
        await invalidateAll();
      }
      showToast = true;
      setTimeout(() => showToast = false, 2000);
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      isRefreshing = false;
    }
  }

  onMount(() => {
    const updateClock = () => {
      const now = new Date();
      currentTime = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' WIB';

      // Auto-fetch every 10 seconds aligned to wall clock (:10, :20)
      if ((now.getSeconds() == 6 || now.getSeconds() == 12) && !isRefreshing) {
        handleRefresh();
      }
    };

    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    return () => clearInterval(clockInterval);
  });

  async function copyJson() {
    if (!apiData) return;
    try {
      const fullPayload = {
        status: 200,
        success: true,
        message: "berhasil",
        data: apiData
      };
      await navigator.clipboard.writeText(JSON.stringify(fullPayload, null, 2));
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  async function copyHistoryJson() {
    if (!historyData || historyData.length === 0) return;
    try {
      const payload = {
        status: 200,
        success: true,
        message: "history",
        data: historyData
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy history', err);
    }
  }
</script>

<div class="dashboard-container">
  <!-- Header -->
  <header class="header-glass">
    <div class="header-content">
      <div class="logo-area">
        <div class="logo-icon"></div>
        <h1>{currentTime || 'Sniper Dashboard'}</h1>
      </div>
      {#if apiData}
        <div class="last-updated">
          <span class="pulse-dot"></span>
          Last Update: {generatedAt}
        </div>
      {/if}
    </div>
  </header>

  {#if errorMsg}
    <div class="error-container glass-panel">
      <h2>Failed to load market data</h2>
      <p>{errorMsg}</p>
    </div>
  {:else if !apiData}
    <div class="loading-container glass-panel">
      <div class="spinner"></div>
      <p>Analyzing market data...</p>
    </div>
  {:else}
    <!-- Global Market Overview -->
    <section class="overview-grid">
      <div class="stat-card glass-panel">
        <div class="stat-label">Market Sentiment</div>
        <div class="stat-value" style="color: {getSentimentColor(apiData.market_sentiment)}">
          {apiData.market_sentiment}
        </div>
      </div>
      <div class="stat-card glass-panel">
        <div class="stat-label">BTC Trend & Strength</div>
        <div class="stat-value" style="font-size: 1.1rem;">
          <span style="color: {getSentimentColor(apiData.btc_trend)}; font-weight: 800;">{apiData.btc_trend}</span>
          <div class="score-bar-container" style="margin: 0 0.25rem;">
            <div class="score-bar" style="width: {apiData.btc_strength_score * 10}%; background: {getSentimentColor(apiData.btc_trend)}"></div>
          </div>
          <span>{apiData.btc_strength_score}/10</span>
        </div>
      </div>
      <div class="stat-card glass-panel">
        <div class="stat-label">Volatility</div>
        <div class="stat-value" style="color: {apiData.market_volatility === 'High' ? 'var(--accent-orange)' : 'var(--text-main)'}">
          {apiData.market_volatility}
        </div>
      </div>
      <div class="stat-card glass-panel signal-counts">
        <div class="signal-count long">
          <span class="label">Longs</span>
          <span class="value">{apiData.long_signals}</span>
        </div>
        <div class="signal-separator"></div>
        <div class="signal-count short">
          <span class="label">Shorts</span>
          <span class="value">{apiData.short_signals}</span>
        </div>
      </div>
    </section>

    <!-- Tab Switcher -->
    <div class="tab-container glass-panel scrollable-tabs">
      <button 
        class="tab-btn {activeTab === 'execute' ? 'active' : ''}" 
        onclick={() => activeTab = 'execute'}
      >
        <span class="tab-icon">🚀</span>
        <span class="tab-label">EXECUTE</span>
        {#if executeSignals.length > 0}<span class="count-badge">{executeSignals.length}</span>{/if}
      </button>
      <button 
        class="tab-btn {activeTab === 'gemini' ? 'active' : ''}" 
        onclick={() => activeTab = 'gemini'}
      >
        <span class="tab-icon">🤖</span>
        <span class="tab-label">AI WATCH</span>
        {#if geminiWatchlist.length > 0}<span class="count-badge">{geminiWatchlist.length}</span>{/if}
      </button>
      <button 
        class="tab-btn {activeTab === 'local' ? 'active' : ''}" 
        onclick={() => activeTab = 'local'}
      >
        <span class="tab-icon">📡</span>
        <span class="tab-label">LOCAL WATCH</span>
        {#if localWatchlist.length > 0}<span class="count-badge">{localWatchlist.length}</span>{/if}
      </button>
      <button 
        class="tab-btn {activeTab === 'rejected' ? 'active' : ''}" 
        onclick={() => activeTab = 'rejected'}
      >
        <span class="tab-icon">🗑️</span>
        <span class="tab-label">REJECTED</span>
        {#if rejectedSignals.length > 0}<span class="count-badge" style="background: var(--accent-red);">{rejectedSignals.length}</span>{/if}
      </button>
      <button 
        class="tab-btn {activeTab === 'history' ? 'active' : ''}" 
        onclick={() => activeTab = 'history'}
      >
        <span class="tab-icon">🎯</span>
        <span class="tab-label">HISTORY</span>
        {#if historyData.length > 0}
          <span class="count-badge">{historyData.length}</span>
        {/if}
      </button>
    </div>

    <!-- Signals List / History -->
    {#if activeTab !== 'history'}
      {@const activeSignals = activeTab === 'execute' ? executeSignals : activeTab === 'gemini' ? geminiWatchlist : activeTab === 'local' ? localWatchlist : rejectedSignals}
      <section class="signals-section" transition:slide>
        <div class="section-header">
          <h2 class="section-title">
            {activeTab === 'execute' ? 'Ready to Execute' : activeTab === 'gemini' ? 'Gemini AI Watchlist' : activeTab === 'local' ? 'Local Scanner Watchlist' : 'Rejected Signals'}
            <button 
              class="refresh-btn {isRefreshing ? 'spinning' : ''}" 
              onclick={handleRefresh} 
              disabled={isRefreshing}
              title="Refresh Market Data"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
          </h2>
          <button class="copy-btn glass-panel" onclick={copyJson}>
            {#if copied}
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="success-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Copied!
            {:else}
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy JSON
            {/if}
          </button>
        </div>
        {#if activeSignals.length === 0}
          <div class="empty-signals glass-panel">
            <div class="empty-icon">🔭</div>
            <h3>No Signals Found</h3>
            <p>This bucket is currently empty. Waiting for setups...</p>
          </div>
        {:else}
          <div class="signals-grid">
            {#each activeSignals as signal}
              <SignalCard {signal} {apiData} btcScore={apiData.btc_strength_score} />
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <section class="signals-section" transition:slide>
        <div class="section-header">
          <h2 class="section-title">
            Sniper History
            <button 
              class="refresh-btn {isRefreshing ? 'spinning' : ''}" 
              onclick={handleRefresh} 
              disabled={isRefreshing}
              title="Refresh History Data"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
          </h2>
          <button class="copy-btn glass-panel" onclick={copyHistoryJson}>
            {#if copied}
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="success-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Copied!
            {:else}
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy JSON
            {/if}
          </button>
        </div>
        {#if isFetchingHistory}
          <div class="empty-signals glass-panel">
            <div class="spinner" style="margin-bottom: 1rem;"></div>
            <h3>Loading History...</h3>
            <p>Fetching the latest sniper records.</p>
          </div>
        {:else if historyData.length === 0}
          <div class="empty-signals glass-panel">
            <div class="empty-icon">📂</div>
            <h3>No History Recorded</h3>
            <p>No Grade A or S signals have been detected in the last 24 hours.</p>
          </div>
        {:else}
          <div class="signals-grid">
            {#each historyData as signal}
              <div class="history-item-wrapper">
                <div class="timestamp-label">
                  {new Date(signal.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <SignalCard {signal} apiData={null} btcScore={0} />
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  {/if}

  <!-- Success Notification (Toast) -->
  {#if showToast}
    <div class="toast-notification glass-panel" transition:slide={{ axis: 'y' }}>
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="#34d399" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Market Data Updated</span>
    </div>
  {/if}
</div>

<style>
  .dashboard-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* Glassmorphism Utilities */
  :global(.glass-panel) {
    background: rgba(24, 27, 33, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    border-radius: 16px;
    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  }

  :global(.glass-panel:hover) {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* Header */
  .header-glass {
    position: sticky;
    top: 0;
    z-index: 100;
    margin-bottom: 2rem;
    padding: 1rem 2rem;
    border-radius: 16px;
    background: rgba(15, 17, 21, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
  }

  .last-updated {
    width: 100%;
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo-icon {
    width: 10px;
    height: 10px;
    background-color: var(--accent-purple);
    border-radius: 50%;
    box-shadow: 0 0 0 rgba(168, 85, 247, 0.4);
    animation: pulse-purple 2s infinite;
  }

  @keyframes pulse-purple {
    0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(168, 85, 247, 0); }
    100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(to right, #fff, #9ca3af);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }

  .last-updated {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background-color: var(--accent-green);
    border-radius: 50%;
    box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }

  /* Overview Grid */
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .stat-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .score-bar-container {
    flex-grow: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .score-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 1s ease-in-out;
  }

  .signal-counts {
    flex-direction: row;
    align-items: center;
    justify-content: space-around;
  }

  .signal-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .signal-count .label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .signal-count.long .value {
    color: var(--accent-green);
    font-size: 1.75rem;
    font-weight: 800;
  }

  .signal-count.short .value {
    color: var(--accent-red);
    font-size: 1.75rem;
    font-weight: 800;
  }

  .signal-separator {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Signals Section */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-title::before {
    content: '';
    display: block;
    width: 4px;
    height: 20px;
    background: var(--accent-blue);
    border-radius: 2px;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-blue);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .success-icon {
    color: var(--accent-green);
  }

  .signals-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    border-radius: 8px;
    padding: 0.35rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-left: 0.75rem;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .refresh-btn.spinning svg {
    animation: spin 1s linear infinite;
  }

  .toast-notification {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1000;
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
    border-color: rgba(52, 211, 153, 0.3) !important;
  }


  .empty-signals {
    padding: 3rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }

  .empty-icon { font-size: 2.5rem; }

  .empty-signals h3 {
    color: var(--text-main);
    font-size: 1.1rem;
    font-weight: 700;
  }

  .empty-signals p {
    color: var(--text-muted);
    font-size: 0.875rem;
    max-width: 400px;
  }
  
  @media (max-width: 1600px) {
    .signals-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  
  @media (max-width: 1200px) {
    .signals-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    .overview-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
  }

  @media (max-width: 900px) {
    .signals-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .loading-container, .error-container {
    padding: 3rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 1.5rem;
    min-height: 300px;
  }

  .error-container h2 {
    color: var(--accent-red);
  }

  .error-container p {
    color: var(--text-muted);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(59, 130, 246, 0.3);
    border-radius: 50%;
    border-top-color: var(--accent-blue);
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive Adjustments */
  @media (max-width: 768px) {
    .dashboard-container {
      padding: 1rem 1rem;
    }

    .header-glass {
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
      border-radius: 12px;
    }

    h1 {
      font-size: 0.9rem;
    }

    .logo-icon {
      width: 8px;
      height: 8px;
    }

    .last-updated {
      font-size: 0.7rem;
    }

    .overview-grid {
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .stat-card {
      padding: 1rem;
    }

    .stat-label {
      font-size: 0.75rem;
    }

    .stat-value {
      font-size: 1.1rem; /* Reduced from 1.25rem */
      letter-spacing: -0.01em;
    }

    .signal-count .label {
      font-size: 0.65rem;
    }

    .signal-count.long .value,
    .signal-count.short .value {
      font-size: 1.25rem;
    }

    .signals-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .tab-label {
      display: none;
    }

    .tab-container {
      justify-content: space-between;
      gap: 0.25rem;
    }
    
    .tab-btn {
      padding: 0.5rem;
      flex: 1;
      justify-content: center;
    }
    
    .tab-icon {
      font-size: 1.2rem;
    }
  }

  /* Tab Styles */
  .tab-container {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    margin-bottom: 2rem;
    width: 100%;
    overflow-x: auto;
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  
  .tab-container::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    border-radius: 12px;
    transition: all 0.2s ease;
    position: relative;
  }

  .tab-btn.active {
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
  }

  .tab-icon {
    font-size: 1.1rem;
  }

  .count-badge {
    background: var(--accent-blue);
    color: #fff;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 10px;
    margin-left: 0.25rem;
  }

  /* History Specific */
  .history-item-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .timestamp-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.1);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    width: fit-content;
    margin-bottom: -0.25rem;
    margin-left: 0.5rem;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
</style>
