<script>
  import Sparkline from "./Sparkline.svelte";
  import { slide } from "svelte/transition";

  let { signal, apiData, btcScore = 0 } = $props();

  let copiedCard = $state(false);
  let showNotes = $state(false);

  // Helper to limit decimals for high-precision coins
  function formatPrice(val) {
    if (!val) return "0.00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return val;
    // Format to max 5 decimals, but remove trailing zeros
    return Number(num.toFixed(5)).toString();
  }

  async function copySignalJson() {
    const payload = {
      status: 200,
      success: true,
      message: "berhasil",
      data: {
        market_sentiment: apiData?.market_sentiment || "Unknown",
        btc_trend: apiData?.btc_trend || "Unknown",
        btc_strength_score: apiData?.btc_strength_score || 0,
        market_volatility: apiData?.market_volatility || "Unknown",
        generated_at: apiData?.generated_at || new Date().toISOString(),
        execute_signals: null,
        gemini_watchlist: null,
        local_watchlist: null,
        rejected_signals: null,
      },
    };

    if (signal.telegram_level === "EXECUTE") {
      payload.data.execute_signals = [signal];
    } else if (
      signal.telegram_level === "WATCH" ||
      signal.telegram_level === "AI_ERROR_REVIEW"
    ) {
      payload.data.gemini_watchlist = [signal];
    } else if (signal.final_status === "LOCAL_WATCH") {
      payload.data.local_watchlist = [signal];
    } else {
      payload.data.rejected_signals = [signal];
    }

    const text = JSON.stringify(payload, null, 2);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copiedCard = true;
      } else {
        // Fallback for non-secure contexts (HTTP)
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (success) {
          copiedCard = true;
        }
      }
      if (copiedCard) {
        setTimeout(() => (copiedCard = false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }

  function getSignalColor(sig) {
    if (!sig) return "var(--text-muted)";
    if (sig.includes("LONG")) return "var(--accent-green)";
    if (sig.includes("SHORT")) return "var(--accent-red)";
    return "var(--text-main)";
  }

  // Helpers
  let isLong = $derived(signal?.signal?.includes("LONG") ?? false);
  let aiData = $derived(signal?.ai || {});

  // RSI Color — Matching cryptoV2 determineSetup
  let rsiColorClass = $derived.by(() => {
    const r = aiData.rsi ?? signal.rsi_15m ?? 0;
    const slope = aiData.rsi_slope ?? 0;

    if (isLong) {
      if (r < 30) return "val--fire"; // range_reversal / extreme dip
      if (r >= 30 && r <= 55 && slope > 0) return "val--hot"; // trend_pullback
      return "val--neutral";
    } else {
      if (r > 70) return "val--fire"; // range_reversal
      if ((r >= 65 || (r > 50 && slope < 0)) && slope < 0) return "val--hot"; // trend_pullback
      return "val--neutral";
    }
  });

  // MFI Color — Matching cryptoV2 calculateV3Score penalties
  let mfiColorClass = $derived.by(() => {
    const m = aiData.mfi ?? signal.mfi_15m ?? 0;
    const slope = aiData.mfi_slope ?? 0;

    if (isLong) {
      if (m > 80) return "val--danger"; // Penalty anomaly
      if (slope > 0 && m < 75) return "val--hot"; // Momentum boost
    } else {
      if (m < 20) return "val--danger"; // Penalty anomaly
      if (slope < 0) return "val--hot"; // Valid momentum
    }
    return "val--neutral";
  });

  // Funding Rate — Matching cryptoV2 calculateV3Score penalties (0.0005)
  let fundingLabel = $derived.by(() => {
    const f = aiData.funding_rate ?? signal.funding_rate ?? 0;
    const fPct = f * 100;

    // Fixed threshold from backend
    const threshold = 0.0005;

    if (Math.abs(f) > threshold) {
      const isCrowded =
        (f > threshold && isLong) || (f < -threshold && !isLong);
      return {
        label: `${f > 0 ? "+" : ""}${fPct.toFixed(3)}%`,
        cls: isCrowded ? "val--danger" : "val--warm",
        tip: `Threshold: 0.05%`,
      };
    }
    return {
      label: `${fPct.toFixed(3)}%`,
      cls: "val--neutral",
      tip: "Healthy Funding",
    };
  });

  // OI Change — Matching cryptoV2 calculateV3Score
  let oiLabel = $derived.by(() => {
    const oi = aiData.oi_change ?? signal.oi_change ?? 0;

    if (oi > 1.5) {
      return { label: `+${oi.toFixed(2)}%`, cls: "val--fire" };
    } else if (oi < 0 && isLong) {
      return { label: `${oi.toFixed(2)}%`, cls: "val--danger" }; // Penalty
    }
    return {
      label: `${oi > 0 ? "+" : ""}${oi.toFixed(2)}%`,
      cls: "val--neutral",
    };
  });

  // Confluence Rating color
  let confluenceColorClass = $derived.by(() => {
    const r = signal.confluence_rating ?? "";
    if (r === "HIGH") return "val--green";
    if (r === "MEDIUM") return "val--warm";
    if (r === "LOW") return "val--gray";
    return "val--neutral";
  });

  // Grade Badge color
  let gradeColorClass = $derived.by(() => {
    const r = signal.grade ?? "";
    if (r.startsWith("Grade S")) return "val--gold";
    if (r.startsWith("Grade A")) return "val--green";
    if (r.startsWith("Grade B") || r.startsWith("Grade C")) return "val--gray";
    return "val--neutral";
  });

  // ADX Logic aligned with backend (Overextended threshold)
  let isDangerTrend = $derived(signal.setup_type === "overextended");
  let adxRising = $derived((aiData.adx_slope ?? 0) > 0);

  let isAntiShort = $derived(!isLong && btcScore >= 8);
  let btcFilterOk = $derived(
    isLong
      ? signal.btc_filter?.toLowerCase().includes("bull")
      : signal.btc_filter?.toLowerCase().includes("bear"),
  );

  // Regime display
  let regimeClass = $derived.by(() => {
    const r = signal.market_structure?.market_regime ?? "";
    if (r.includes("Trending Bullish")) return "regime-bull";
    if (r.includes("Trending Bearish")) return "regime-bear";
    if (r.includes("Squeeze")) return "regime-squeeze";
    return "regime-chop";
  });

  // Master Status based on backend output
  let masterStatus = $derived.by(() => {
    if (signal.setup_type === "overextended") {
      return { text: "⚠️ OVEREXTENDED TREND", bg: "bg-rose" };
    }
    if (signal.confidence === "HIGH") {
      return { text: "🎯 EXECUTE TARGET", bg: "bg-green" };
    }
    if (signal.confidence === "MEDIUM") {
      return { text: "🔍 STALKING...", bg: "bg-amber" };
    }
    return { text: "⚖️ NEUTRAL ZONE", bg: "bg-slate" };
  });
</script>

<div class="signal-card glass-panel {isDangerTrend ? 'danger-glow' : ''}">
  <!-- Status Banner -->
  <div class="master-banner {masterStatus.bg}">
    <span class="status-dot"></span>
    {masterStatus.text}
  </div>

  <div class="card-content">
    <!-- Header: Symbol & Price -->
    <div class="card-header">
      <div class="sym-block">
        <div class="sym-row">
          <h3>{signal.symbol}</h3>
          <button
            class="icon-copy-btn"
            onclick={copySignalJson}
            title="Copy JSON Signal"
          >
            {#if copiedCard}
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="#34d399"
                stroke-width="3"
                fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg
              >
            {:else}
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"
                ></rect><path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                ></path></svg
              >
            {/if}
          </button>
        </div>

        <div class="grade-row">
          <div
            class="grade-badge {gradeColorClass}"
            title={signal.grade}
          >
            {signal.grade}
          </div>
          <div
            class="grade-badge {confluenceColorClass}"
            title={signal.confluence_rating}
          >
            {signal.confluence_rating}
          </div>
        </div>

        <div class="status-row">
          <span class="score-tag">[{signal.score?.toFixed(2)}]</span>
          <span
            class="sig-badge"
            style="color:{getSignalColor(
              signal.signal,
            )}; border: 1px solid {getSignalColor(signal.signal)}40"
          >
            {signal.signal?.replace("_", " ")}
          </span>
        </div>
      </div>
      <div class="price-block">
        <div class="main-price">${signal.last_price}</div>
        <div
          class="price-change {signal.price_change_24h >= 0 ? 'pos' : 'neg'}"
        >
          {signal.price_change_24h >= 0 ? "▲" : "▼"}
          {Math.abs(signal.price_change_24h)}%
        </div>
      </div>
    </div>

    <!-- Live Chart -->
    <div class="chart-area">
      <Sparkline data={signal.raw_klines} width={400} height={50} />
    </div>

    <!-- Core Metrics Grid -->
    <div class="metrics-container">
      <div class="metric-item">
        <span class="m-label">RSI</span>
        <span class="m-value {rsiColorClass}">{signal.rsi_15m?.toFixed(2)}</span
        >
      </div>
      <div class="metric-item">
        <span class="m-label">MFI</span>
        <span class="m-value {mfiColorClass}">{signal.mfi_15m?.toFixed(2)}</span
        >
      </div>
      <div class="metric-item">
        <span class="m-label">ADX</span>
        <span class="m-value">{signal.adx_15m?.toFixed(2)}</span>
      </div>
      <div class="metric-item">
        <span class="m-label">OI</span>
        <span class="m-value {oiLabel.cls}">{oiLabel.label}</span>
      </div>
      <div class="metric-item">
        <span class="m-label">FUND</span>
        <span class="m-value {fundingLabel.cls}">{fundingLabel.label}</span>
      </div>
      <div class="metric-item">
        <span class="m-label">BTC</span>
        <span class="m-value {btcFilterOk ? 'val--fire' : 'val--danger'}"
          >{signal.btc_filter?.split(" ")[0]}</span
        >
      </div>
    </div>

    <!-- Execution Plan Block -->
    <div class="execution-grid">
      <div class="exec-block">
        <div class="block-head">ENTRY ZONE</div>
        <div class="val-large">${formatPrice(signal.entry_zone)}</div>
        <div class="sub-info">
          Hold: {signal.max_hold_candles}c ({signal.max_hold_minutes}m)
        </div>
      </div>
      <div class="exec-block">
        <div class="block-head">TARGET / RISK</div>
        <div class="target-row">
          <span class="t-label">TP1</span>
          <span class="pos font-bold">${formatPrice(signal.tp1)}</span>
        </div>
        <div class="target-row">
          <span class="t-label">TP2</span>
          <span class="pos font-bold">${formatPrice(signal.tp2)}</span>
        </div>
        <div class="target-row">
          <span class="t-label">SL</span>
          <span class="neg font-bold">${formatPrice(signal.stop_loss)}</span>
        </div>
      </div>
    </div>

    <!-- Extra Intelligence -->
    <div class="intel-footer">
      <div class="regime-tag" title="Market Structure">
        <span class="regime-icon">🌐</span>
        {signal.market_structure?.description || "Mid Range"}
      </div>
      {#if signal.liquidation_levels?.is_hunting}
        <div class="hunt-tag">🎯 STOP HUNT</div>
      {/if}
    </div>

    {#if signal.notes?.length > 0}
      <div class="notes-container">
        <button class="notes-toggle" onclick={() => (showNotes = !showNotes)}>
          <span>{showNotes ? "HIDE NOTES" : "SHOW NOTES"}</span>
          <svg
            class:rotate={showNotes}
            viewBox="0 0 24 24"
            width="10"
            height="10"
            stroke="currentColor"
            stroke-width="3"
            fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg
          >
        </button>

        {#if showNotes}
          <div class="notes-line" transition:slide>
            {#each signal.notes as note}
              <span class="note-tag">{note}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* === Premium Signal Card === */
  .signal-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .signal-card:hover {
    transform: translateY(-5px);
    background: rgba(30, 41, 59, 0.7);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.5);
  }

  .danger-glow {
    border-color: rgba(244, 63, 94, 0.3) !important;
    box-shadow: 0 0 20px rgba(244, 63, 94, 0.1);
  }

  /* Status Banner */
  .master-banner {
    padding: 0.5rem;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 10px currentColor;
  }

  .card-content {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sym-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .sym-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sym-block h3 {
    font-size: 1.3rem;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.02em;
    color: #f8fafc;
  }

  .grade-row {
    display: flex;
    min-width: 0;
    gap: 0.5rem;
  }

  .grade-badge {
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px; /* Protect price block from clashing */
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .sig-badge {
    font-size: 0.55rem;
    font-weight: 900;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }

  .score-tag {
    font-size: 0.65rem;
    font-weight: 800;
    color: #ffffff; /* White color for contrast */
    opacity: 1;
    font-family: "JetBrains Mono", monospace;
  }

  .price-block {
    text-align: right;
  }
  .main-price {
    font-size: 1.2rem;
    font-weight: 800;
    color: #f8fafc;
  }
  .price-change {
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 0.1rem;
  }

  /* Metrics Grid */
  .metrics-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.4);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    text-align: center;
  }
  .m-label {
    font-size: 0.55rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .m-value {
    font-size: 0.9rem;
    font-weight: 900;
    color: #f8fafc;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Ensure dynamic colors override the default white */
  .m-value.val--fire {
    color: #10b981 !important;
    text-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }
  .m-value.val--hot {
    color: #34d399 !important;
  }
  .m-value.val--warm {
    color: #f59e0b !important;
  }
  .m-value.val--danger {
    color: #f43f5e !important;
  }
  .m-value.val--neutral {
    color: #64748b !important;
  }

  /* Grade Specific Text Colors (Solid & Bright) */
  .grade-badge.val--gold {
    color: #ffd700;
  }
  .grade-badge.val--green {
    color: #4ade80;
  }
  .grade-badge.val--gray {
    color: #94a3b8;
  }

  /* Execution Grid */
  .execution-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .exec-block {
    background: rgba(255, 255, 255, 0.03);
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .block-head {
    font-size: 0.55rem;
    font-weight: 800;
    color: #64748b;
    margin-bottom: 0.3rem;
  }
  .val-large {
    font-size: 1.2rem;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  .sub-info {
    font-size: 0.6rem;
    color: #475569;
    margin-top: 0.2rem;
  }

  .target-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    margin-top: 0.2rem;
  }

  .t-label {
    color: #64748b;
    font-weight: 600;
  }
  .font-bold {
    font-weight: 800;
  }

  /* Intelligence */
  .intel-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .regime-tag,
  .hunt-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.3rem 0.6rem;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
    color: #cbd5e1;
  }

  .hunt-tag {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .notes-container {
    margin-top: -0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .notes-toggle {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 0.55rem;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0;
    letter-spacing: 0.05em;
    transition: color 0.2s;
  }

  .notes-toggle:hover {
    color: #94a3b8;
  }
  .notes-toggle svg {
    transition: transform 0.3s ease;
  }
  .notes-toggle svg.rotate {
    transform: rotate(180deg);
  }

  .notes-line {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .note-tag {
    font-size: 0.55rem;
    font-weight: 700;
    color: #60a5fa;
    background: rgba(96, 165, 250, 0.1);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .sym-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-copy-btn {
    background: transparent;
    border: none;
    color: #94a3b8; /* Brighter slate for better contrast */
    cursor: pointer;
    padding: 0.2rem;
    display: flex;
    align-items: center;
    transition: all 0.2s;
    margin-top: 0.1rem;
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
  }

  .icon-copy-btn:hover {
    color: #f8fafc;
  }

  /* Colors */
  .pos {
    color: #10b981;
  }
  .neg {
    color: #f43f5e;
  }
  .val--fire {
    color: #34d399;
  }
  .val--danger {
    color: #fb7185;
  }

  .bg-green {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }
  .bg-amber {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
  .bg-rose {
    background: rgba(244, 63, 94, 0.1);
    color: #fb7185;
  }
  .bg-slate {
    background: rgba(100, 116, 139, 0.1);
    color: #94a3b8;
  }
</style>
