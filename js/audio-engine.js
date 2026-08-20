/**
 * ZenPulse — Procedural Web Audio Synthesis Engine
 * Zero external audio assets. 100% native client-side synthesis.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Active sound generators
    this.tracks = {
      rain: { active: true, volume: 0.4, nodes: null },
      fire: { active: false, volume: 0.35, nodes: null },
      binaural: { active: true, volume: 0.3, nodes: null },
      wind: { active: false, volume: 0.25, nodes: null },
      ocean: { active: false, volume: 0.3, nodes: null },
      noise: { active: false, volume: 0.2, nodes: null }
    };

    // Shared noise buffers
    this.pinkBuffer = null;
    this.brownBuffer = null;
    this.whiteBuffer = null;

    // Timers for procedural particle sounds (raindrops, crackles)
    this.rainDropTimer = null;
    this.fireCrackleTimer = null;
  }

  /**
   * Initialize AudioContext on first user gesture
   */
  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }

    this.ctx = new AudioContextClass();
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

    // Analyser Node for visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Generate looping noise buffers
    this.generateNoiseBuffers();

    this.isInitialized = true;

    // Start initially active tracks
    Object.keys(this.tracks).forEach(trackName => {
      if (this.tracks[trackName].active) {
        this.startTrack(trackName);
      }
    });
  }

  /**
   * Generate 5-second looping White, Pink, and Brown noise buffers
   */
  generateNoiseBuffers() {
    const bufferSize = this.ctx.sampleRate * 5;
    
    // 1. White Noise
    this.whiteBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const whiteData = this.whiteBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // 2. Pink Noise (Paul Kellet's filter method)
    this.pinkBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const pinkData = this.pinkBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 3. Brown Noise (Brownian Integration)
    this.brownBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const brownData = this.brownBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      brownData[i] = lastOut * 3.5;
    }
  }

  /**
   * Helper to create looping buffer source
   */
  createLoopSource(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  /**
   * Start sound track synthesis
   */
  startTrack(name) {
    if (!this.ctx) return;
    if (this.tracks[name].nodes) return; // Already running

    const gain = this.ctx.createGain();
    const targetVol = this.tracks[name].volume;
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), this.ctx.currentTime + 0.5);

    gain.connect(this.masterGain);

    if (name === 'rain') {
      // Pink noise through bandpass
      const noise = this.createLoopSource(this.pinkBuffer);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      noise.start(0);

      // Raindrop scheduler
      this.scheduleRainDrops(gain);

      this.tracks.rain.nodes = { noise, filter, gain };

    } else if (name === 'fire') {
      // Brown noise warm body
      const noise = this.createLoopSource(this.brownBuffer);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      noise.start(0);

      // Crackle & pop scheduler
      this.scheduleFireCrackle(gain);

      this.tracks.fire.nodes = { noise, filter, gain };

    } else if (name === 'binaural') {
      // Binaural Beats: Left = 216Hz, Right = 226Hz (10Hz Alpha wave difference)
      const baseFreq = 216;
      const beatFreq = 10;

      const merger = this.ctx.createChannelMerger(2);
      
      const oscL = this.ctx.createOscillator();
      oscL.type = 'sine';
      oscL.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      const oscR = this.ctx.createOscillator();
      oscR.type = 'sine';
      oscR.frequency.setValueAtTime(baseFreq + beatFreq, this.ctx.currentTime);

      // Warm harmonic sub-drone (108Hz)
      const oscSub = this.ctx.createOscillator();
      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(baseFreq / 2, this.ctx.currentTime);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      oscSub.connect(subGain);

      // Routing
      oscL.connect(merger, 0, 0); // Left ear
      oscR.connect(merger, 0, 1); // Right ear
      subGain.connect(merger, 0, 0);
      subGain.connect(merger, 0, 1);

      merger.connect(gain);

      oscL.start(0);
      oscR.start(0);
      oscSub.start(0);

      this.tracks.binaural.nodes = { oscL, oscR, oscSub, merger, gain };

    } else if (name === 'wind') {
      // Filtered pink noise modulated by slow LFO
      const noise = this.createLoopSource(this.pinkBuffer);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      // LFO for breathing wind sweeps
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(320, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      noise.connect(filter);
      filter.connect(gain);

      noise.start(0);
      lfo.start(0);

      this.tracks.wind.nodes = { noise, filter, lfo, lfoGain, gain };

    } else if (name === 'ocean') {
      // Lowpass pink noise modulated by ocean swell LFO
      const noise = this.createLoopSource(this.pinkBuffer);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);

      const swellGain = this.ctx.createGain();
      
      // Tidal swell LFO (8.5s cycle)
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.11, this.ctx.currentTime);
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      const lfoFilterGain = this.ctx.createGain();
      lfoFilterGain.gain.setValueAtTime(400, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(swellGain.gain);

      lfo.connect(lfoFilterGain);
      lfoFilterGain.connect(filter.frequency);

      noise.connect(filter);
      filter.connect(swellGain);
      swellGain.connect(gain);

      noise.start(0);
      lfo.start(0);

      this.tracks.ocean.nodes = { noise, filter, lfo, swellGain, gain };

    } else if (name === 'noise') {
      // Pure Pink Noise focus mask
      const noise = this.createLoopSource(this.pinkBuffer);
      noise.connect(gain);
      noise.start(0);

      this.tracks.noise.nodes = { noise, gain };
    }
  }

  /**
   * Stop sound track synthesis smoothly
   */
  stopTrack(name) {
    const track = this.tracks[name];
    if (!track || !track.nodes) return;

    const nodes = track.nodes;
    if (nodes.gain && this.ctx) {
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, this.ctx.currentTime);
      nodes.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      
      setTimeout(() => {
        try {
          if (nodes.noise) nodes.noise.stop();
          if (nodes.oscL) nodes.oscL.stop();
          if (nodes.oscR) nodes.oscR.stop();
          if (nodes.oscSub) nodes.oscSub.stop();
          if (nodes.lfo) nodes.lfo.stop();
        } catch (e) {
          // Already stopped
        }
        track.nodes = null;
      }, 350);
    } else {
      track.nodes = null;
    }

    if (name === 'rain' && this.rainDropTimer) {
      clearTimeout(this.rainDropTimer);
      this.rainDropTimer = null;
    }
    if (name === 'fire' && this.fireCrackleTimer) {
      clearTimeout(this.fireCrackleTimer);
      this.fireCrackleTimer = null;
    }
  }

  /**
   * Procedural micro raindrop impulses
   */
  scheduleRainDrops(parentGain) {
    if (!this.tracks.rain.active || !this.ctx) return;

    const playDrop = () => {
      if (!this.tracks.rain.active || !this.ctx) return;

      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      
      // Random droplet pitch (1800Hz - 3800Hz)
      const freq = 1800 + Math.random() * 2000;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, this.ctx.currentTime + 0.04);

      const dropVol = (0.05 + Math.random() * 0.08) * this.tracks.rain.volume;
      dropGain.gain.setValueAtTime(dropVol, this.ctx.currentTime);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.045);

      osc.connect(dropGain);
      dropGain.connect(parentGain);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.05);

      const nextDelay = 30 + Math.random() * 90;
      this.rainDropTimer = setTimeout(playDrop, nextDelay);
    };

    playDrop();
  }

  /**
   * Procedural fireplace crackle & wood pops
   */
  scheduleFireCrackle(parentGain) {
    if (!this.tracks.fire.active || !this.ctx) return;

    const playCrackle = () => {
      if (!this.tracks.fire.active || !this.ctx) return;

      const isPop = Math.random() > 0.65;
      
      if (isPop) {
        // Deeper wood pop
        const osc = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        const freq = 120 + Math.random() * 280;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

        const popVol = (0.15 + Math.random() * 0.25) * this.tracks.fire.volume;
        popGain.gain.setValueAtTime(popVol, this.ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

        osc.connect(popGain);
        popGain.connect(parentGain);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.09);
      } else {
        // High frequency crisp snap
        const snapSource = this.ctx.createBufferSource();
        snapSource.buffer = this.whiteBuffer;
        const snapFilter = this.ctx.createBiquadFilter();
        snapFilter.type = 'highpass';
        snapFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);

        const snapGain = this.ctx.createGain();
        const snapVol = (0.08 + Math.random() * 0.15) * this.tracks.fire.volume;
        snapGain.gain.setValueAtTime(snapVol, this.ctx.currentTime);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.025);

        snapSource.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(parentGain);

        snapSource.start(this.ctx.currentTime);
        snapSource.stop(this.ctx.currentTime + 0.03);
      }

      const nextDelay = 40 + Math.random() * 220;
      this.fireCrackleTimer = setTimeout(playCrackle, nextDelay);
    };

    playCrackle();
  }

  /**
   * Set volume for a specific track
   */
  setTrackVolume(name, value) {
    this.tracks[name].volume = parseFloat(value);
    const nodes = this.tracks[name].nodes;
    if (nodes && nodes.gain && this.ctx) {
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, this.ctx.currentTime);
      nodes.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.tracks[name].volume), this.ctx.currentTime + 0.1);
    }
  }

  /**
   * Toggle a track on/off
   */
  toggleTrack(name) {
    this.init();
    this.tracks[name].active = !this.tracks[name].active;
    if (this.tracks[name].active) {
      this.startTrack(name);
    } else {
      this.stopTrack(name);
    }
    return this.tracks[name].active;
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   */
  setMasterVolume(val) {
    if (!this.masterGain || !this.ctx) return;
    const volume = parseFloat(val);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), this.ctx.currentTime + 0.05);
  }

  /**
   * Toggle Mute All Audio
   */
  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    if (!this.masterGain || !this.ctx) return this.isMuted;

    if (this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
    } else {
      const currentSliderVal = parseFloat(document.getElementById('masterVolume')?.value || 0.75);
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(currentSliderVal, this.ctx.currentTime + 0.2);
    }
    return this.isMuted;
  }

  /**
   * Load Soundscape Presets
   */
  applyPreset(presetKey) {
    this.init();

    const presets = {
      'study': { rain: 0.35, fire: 0, binaural: 0.3, wind: 0, ocean: 0, noise: 0 },
      'rainy-cabin': { rain: 0.6, fire: 0.45, binaural: 0, wind: 0.2, ocean: 0, noise: 0 },
      'campfire': { rain: 0, fire: 0.6, binaural: 0.2, wind: 0.35, ocean: 0, noise: 0 },
      'waves': { rain: 0.15, fire: 0, binaural: 0.25, wind: 0.2, ocean: 0.55, noise: 0 },
      'clear': { rain: 0, fire: 0, binaural: 0, wind: 0, ocean: 0, noise: 0 }
    };

    const targetConfig = presets[presetKey];
    if (!targetConfig) return;

    Object.keys(targetConfig).forEach(soundKey => {
      const vol = targetConfig[soundKey];
      const shouldBeActive = vol > 0;

      this.tracks[soundKey].active = shouldBeActive;
      this.tracks[soundKey].volume = vol || 0.3;

      if (shouldBeActive) {
        if (!this.tracks[soundKey].nodes) {
          this.startTrack(soundKey);
        } else {
          this.setTrackVolume(soundKey, vol);
        }
      } else {
        this.stopTrack(soundKey);
      }
    });
  }

  /**
   * Play Tibetan Singing Bowl Completion Chime
   */
  playSessionChime() {
    this.init();
    if (!this.ctx) return;

    const baseFreq = 528; // Solfeggio Love / Miracle Frequency
    const harmonics = [1, 2, 3, 4.2];
    const gains = [0.4, 0.2, 0.1, 0.04];
    const duration = 4.0;

    harmonics.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * ratio, this.ctx.currentTime);

      gain.gain.setValueAtTime(gains[i], this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    });
  }

  /**
   * Play Task Complete Micro-Chime
   */
  playTaskChime() {
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startT = this.ctx.currentTime + (idx * 0.07);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.12, startT);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startT);
      osc.stop(startT + 0.36);
    });
  }

  /**
   * Get audio level for reactive visualizer
   */
  getAudioLevel() {
    if (!this.analyser || this.isMuted) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }
}

// Global instance
window.zenAudio = new AudioEngine();
