/**
 * ZenPulse — Canvas Particle & Reactive Aura Visualizer
 */

class Visualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.ripples = [];
    this.numParticles = 55;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Spawn initial particles
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle());
    }

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  createParticle() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: Math.random() * 2.2 + 0.8,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      baseAlpha: Math.random() * 0.45 + 0.15,
      alpha: 0.3,
      hueOffset: Math.random() * 40 - 20
    };
  }

  /**
   * Spawn a gentle ripple wave from center
   */
  emitRipple() {
    this.ripples.push({
      x: this.width / 2,
      y: this.height / 2,
      radius: 80,
      maxRadius: Math.max(this.width, this.height) * 0.65,
      alpha: 0.4,
      speed: 1.8
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Audio reactive factor
    const audioLevel = window.zenAudio ? window.zenAudio.getAudioLevel() : 0;
    const boost = 1 + (audioLevel * 2.2);

    // 1. Draw & Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed * boost;
      r.alpha -= 0.003 * boost;

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(139, 92, 246, ${r.alpha * 0.45})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // Periodically emit subtle ripple if audio is active
    if (audioLevel > 0.08 && Math.random() < 0.03) {
      this.emitRipple();
    }

    // 2. Draw & Update Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Update position with audio speed boost
      p.x += p.vx * boost;
      p.y += p.vy * boost;

      // Wrap around bounds
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Dynamic reactive alpha & size
      const currentRadius = p.radius * (1 + audioLevel * 0.8);
      const currentAlpha = Math.min(0.85, p.baseAlpha + audioLevel * 0.4);

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(220, 215, 254, ${currentAlpha})`;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Draw subtle connecting constellation lines
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          const lineAlpha = (1 - dist / 110) * 0.15 * (1 + audioLevel);
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(167, 139, 250, ${lineAlpha})`;
          this.ctx.lineWidth = 0.75;
          this.ctx.stroke();
        }
      }
    }

    requestAnimationFrame(this.animate);
  }
}

// Instantiate visualizer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.zenVisualizer = new Visualizer('ambientCanvas');
});
