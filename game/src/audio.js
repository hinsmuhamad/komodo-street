// audio.js
// Komodo Street. Tiny synth audio: an engine hum that follows speed, a
// two tone police siren while wanted, plus blip and click effects.
// Nothing starts until the first user gesture, and every call is guarded
// so audio can never throw when it is not started.

function makeOsc(ctx, type, freq) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  return osc;
}

export function createAudio(state) {
  let ctx = null;
  let master = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
  } catch (err) {
    ctx = null;
    master = null;
  }

  const a = {
    ctx,
    master,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    started: false,
    sirenTimer: 0,
    sirenHigh: false,

    start() {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.started = true;
        this.ensureOsc();
      } catch (err) {
        // Audio stays silent, the game keeps running.
      }
    },

    resume() {
      this.start();
    },

    ensureOsc() {
      if (!this.ctx || !this.master) return;
      if (!this.engineOsc) {
        this.engineOsc = makeOsc(this.ctx, 'sawtooth', 60);
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (!this.sirenOsc) {
        this.sirenOsc = makeOsc(this.ctx, 'sine', 700);
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
    },
  };

  state.audioSys = a;
  return a;
}

export function updateAudio(state, a, dt) {
  if (!a || !a.started || !a.ctx || !a.master) return;
  try {
    a.ensureOsc();
    const p = state.player || {};
    const speed = Math.abs(p.speed || 0);
    const driving = !p.onFoot && speed > 0.1;

    if (a.engineOsc && a.engineGain) {
      const freq = driving ? Math.min(220, 55 + speed * 3.5) : 55;
      a.engineOsc.frequency.setTargetAtTime(freq, a.ctx.currentTime, 0.08);
      const vol = driving ? Math.min(0.09, 0.04 + speed * 0.0012) : 0;
      a.engineGain.gain.setTargetAtTime(vol, a.ctx.currentTime, 0.1);
    }

    if (a.sirenOsc && a.sirenGain) {
      if ((state.wanted || 0) > 0) {
        a.sirenTimer += dt || 0.016;
        if (a.sirenTimer > 0.45) {
          a.sirenTimer = 0;
          a.sirenHigh = !a.sirenHigh;
          a.sirenOsc.frequency.setTargetAtTime(
            a.sirenHigh ? 880 : 660,
            a.ctx.currentTime,
            0.05
          );
        }
        a.sirenGain.gain.setTargetAtTime(0.035, a.ctx.currentTime, 0.1);
      } else {
        a.sirenGain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.1);
      }
    }
  } catch (err) {
    // Audio stays silent, the game keeps running.
  }
}

function blipTone(a, freq, dur, vol, type) {
  if (!a || !a.started || !a.ctx || !a.master) return;
  try {
    const osc = makeOsc(a.ctx, type || 'sine', freq);
    const gain = a.ctx.createGain();
    const now = a.ctx.currentTime;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(a.master);
    osc.start(now);
    osc.stop(now + dur);
  } catch (err) {
    // Silent.
  }
}

export function playBlip(state) {
  blipTone(state.audioSys, 990, 0.14, 0.12, 'sine');
}

export function playClick(state) {
  blipTone(state.audioSys, 1250, 0.05, 0.08, 'square');
}
