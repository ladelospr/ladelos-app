// Los navegadores solo permiten sonido después de que la persona toca la pantalla.
// La app funciona igual sin sonido: todas las alertas también son visuales.
let ctx: AudioContext | null = null;

export function enableSound(): boolean {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    void ctx.resume();
    beep([880], 0.08);
    return true;
  } catch {
    return false;
  }
}

export function soundReady() {
  return !!ctx && ctx.state === 'running';
}

function beep(freqs: number[], dur = 0.15, gap = 0.08) {
  if (!ctx) return;
  let t = ctx.currentTime;
  for (const f of freqs) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
    t += dur + gap;
  }
}

export const sounds = {
  urgent: () => beep([1046, 1046, 1046], 0.12, 0.07),
  soft: () => beep([660, 880], 0.14, 0.05),
};
