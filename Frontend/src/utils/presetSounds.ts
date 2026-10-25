export type PresetId = 'chime' | 'bell' | 'alert'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'alert', label: 'Alert tone' },
]

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** One decaying oscillator note. */
function note(
  audio: AudioContext,
  {
    freq,
    start,
    duration,
    type = 'sine',
    gain = 0.2,
  }: {
    freq: number
    start: number
    duration: number
    type?: OscillatorType
    gain?: number
  },
) {
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  const t0 = audio.currentTime + start
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp).connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

const synths: Record<PresetId, (audio: AudioContext) => void> = {
  chime(audio) {
    note(audio, { freq: 880, start: 0, duration: 0.9 })
    note(audio, { freq: 1318.5, start: 0.18, duration: 1.1, gain: 0.16 })
  },
  bell(audio) {
    // fundamental + inharmonic partials give a metallic strike
    const partials: [number, number][] = [
      [1, 0.22],
      [2.76, 0.1],
      [5.4, 0.05],
    ]
    for (const [ratio, gain] of partials) {
      note(audio, { freq: 660 * ratio, start: 0, duration: 1.6, gain })
    }
  },
  alert(audio) {
    for (let i = 0; i < 3; i++) {
      note(audio, { freq: 740, start: i * 0.22, duration: 0.16, type: 'triangle', gain: 0.22 })
    }
  },
}

export function playPreset(id: PresetId) {
  const audio = getContext()
  if (audio) synths[id](audio)
}
