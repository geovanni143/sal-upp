const samples = [];
export function markScreenReady() {
  const t = performance.now();
  samples.push(t);
  if (samples.length % 20 === 0) {
    const sorted = [...samples].sort((a,b)=>a-b);
    const p95 = sorted[Math.max(0, Math.floor(sorted.length*0.95)-1)];
    navigator.sendBeacon("/metrics", JSON.stringify({ path: location.pathname, p95_ms: Math.round(p95) }));
  }
}
