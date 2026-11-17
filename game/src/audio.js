// All of the game's sound is generated with WebAudio: no audio files, no network. Short
// oscillator and noise envelopes make the chimes, thumps, whooshes and fanfares; the audio
// context is created on the first key press or click, as browsers require.

const MASTER_VOLUME = 0.32;

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  /** Create or wake the audio context. Called from the first input event. */
  function unlock() {
    try {
      if (!context) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        context = new AudioCtor();
        master = context.createGain();
        master.gain.value = MASTER_VOLUME;
        master.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume();
    } catch {
      context = null;
    }
  }

  function ready() {
    return context !== null && master !== null && context.state !== 'closed' && !muted;
  }

  /** One enveloped oscillator note, optionally sweeping and filtered. */
  function tone({ freq, to = null, dur = 0.2, type = 'sine', gain = 0.15, delay = 0, attack = 0.008, filter = null }) {
    if (!ready()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = osc;
    if (filter) {
      const biquad = context.createBiquadFilter();
      biquad.type = filter.type;
      biquad.frequency.setValueAtTime(filter.freq, start);
      if (filter.to) biquad.frequency.exponentialRampToValueAtTime(filter.to, start + dur);
      biquad.Q.value = filter.q ?? 1;
      node.connect(biquad);
      node = biquad;
    }
    node.connect(envelope);
    envelope.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  /** One enveloped burst of generated white noise, for air and impact. */
  function noise({ dur = 0.2, gain = 0.12, delay = 0, type = 'highpass', freq = 800, to = null, q = 0.8 }) {
    if (!ready()) return;
    if (!noiseBuffer) {
      const length = Math.floor(context.sampleRate * 0.6);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const biquad = context.createBiquadFilter();
    biquad.type = type;
    biquad.frequency.setValueAtTime(freq, start);
    if (to !== null) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + dur);
    biquad.Q.value = q;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(biquad);
    biquad.connect(envelope);
    envelope.connect(master);
    source.start(start);
    source.stop(start + dur + 0.03);
  }

  const PENTATONIC = [0, 2, 4, 7, 9, 12];

  function pickup(chain = 1) {
    const semitone = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, chain - 1))];
    const freq = 660 * 2 ** (semitone / 12);
    tone({ freq, to: freq * 1.5, dur: 0.12, type: 'sine', gain: 0.16 });
    tone({ freq: freq * 2, to: freq * 2.3, dur: 0.09, type: 'triangle', gain: 0.05, delay: 0.02 });
  }

  function deposit(count = 1) {
    const notes = [440, 554.37, 659.25];
    for (let index = 0; index < notes.length; index += 1) {
      tone({ freq: notes[index], dur: 0.26, type: 'triangle', gain: 0.1, delay: index * 0.06 });
    }
    tone({ freq: 220, to: 330, dur: 0.4, type: 'sine', gain: 0.1 });
    noise({ dur: 0.22, gain: 0.03, type: 'highpass', freq: 2400, to: 6000 });
    if (count >= 3) tone({ freq: 1318.5, dur: 0.22, type: 'sine', gain: 0.06, delay: 0.16 });
  }

  function hit() {
    tone({ freq: 150, to: 54, dur: 0.34, type: 'sawtooth', gain: 0.2, filter: { type: 'lowpass', freq: 900, to: 180, q: 1.4 } });
    noise({ dur: 0.2, gain: 0.14, type: 'lowpass', freq: 1200, to: 200 });
    tone({ freq: 82, to: 46, dur: 0.3, type: 'sine', gain: 0.2 });
  }

  function pulse() {
    tone({ freq: 240, to: 940, dur: 0.26, type: 'sine', gain: 0.13 });
    tone({ freq: 940, to: 320, dur: 0.34, type: 'triangle', gain: 0.07, delay: 0.1 });
    noise({ dur: 0.3, gain: 0.06, type: 'bandpass', freq: 500, to: 2600, q: 1.2 });
  }

  function dash() {
    noise({ dur: 0.2, gain: 0.07, type: 'highpass', freq: 340, to: 1800 });
    tone({ freq: 520, to: 960, dur: 0.15, type: 'triangle', gain: 0.05 });
  }

  function levelClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let index = 0; index < notes.length; index += 1) {
      tone({ freq: notes[index], dur: 0.34, type: 'triangle', gain: 0.11, delay: index * 0.075 });
    }
    noise({ dur: 0.5, gain: 0.03, type: 'highpass', freq: 2600, to: 7000 });
  }

  function win() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (let index = 0; index < notes.length; index += 1) {
      tone({ freq: notes[index], dur: 0.7, type: 'triangle', gain: 0.1, delay: index * 0.11 });
    }
    tone({ freq: 261.63, dur: 1.8, type: 'sine', gain: 0.07, delay: 0.1 });
    tone({ freq: 329.63, dur: 1.8, type: 'sine', gain: 0.06, delay: 0.1 });
    tone({ freq: 392, dur: 1.8, type: 'sine', gain: 0.05, delay: 0.1 });
    noise({ dur: 1, gain: 0.025, type: 'highpass', freq: 3200, to: 9000 });
  }

  function lose() {
    const notes = [392, 329.63, 261.63, 196];
    for (let index = 0; index < notes.length; index += 1) {
      tone({
        freq: notes[index],
        to: notes[index] * 0.985,
        dur: 0.5,
        type: 'sawtooth',
        gain: 0.075,
        delay: index * 0.16,
        filter: { type: 'lowpass', freq: 1100, to: 420, q: 1 },
      });
    }
    tone({ freq: 110, to: 68, dur: 1.1, type: 'sine', gain: 0.14, delay: 0.1 });
  }

  function click() {
    tone({ freq: 740, to: 660, dur: 0.06, type: 'sine', gain: 0.06 });
  }

  return {
    unlock,
    isMuted() {
      return muted;
    },
    setMuted(value) {
      muted = Boolean(value);
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (!muted) click();
      return muted;
    },
    pickup,
    deposit,
    hit,
    pulse,
    dash,
    levelClear,
    win,
    lose,
    click,
  };
}

/** A silent stand-in, so the screenshot scenes run the same game code without opening audio. */
export function createSilentAudio() {
  return {
    unlock() {},
    isMuted() {
      return true;
    },
    setMuted() {
      return true;
    },
    toggleMute() {
      return true;
    },
    pickup() {},
    deposit() {},
    hit() {},
    pulse() {},
    dash() {},
    levelClear() {},
    win() {},
    lose() {},
    click() {},
  };
}
