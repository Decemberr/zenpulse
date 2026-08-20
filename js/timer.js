/**
 * ZenPulse — Pomodoro & Flow Timer Module
 */

class PomodoroTimer {
  constructor() {
    this.modes = {
      focus: { name: 'FOCUS SESSION', duration: 25 * 60 },
      shortBreak: { name: 'SHORT BREAK', duration: 5 * 60 },
      longBreak: { name: 'LONG BREAK', duration: 15 * 60 }
    };

    this.currentMode = 'focus';
    this.totalDuration = this.modes.focus.duration;
    this.remainingSeconds = this.totalDuration;
    this.isRunning = false;
    this.timerInterval = null;
    this.lastTimestamp = null;

    // Statistics
    this.completedSessions = parseInt(localStorage.getItem('zenpulse_sessions') || '0', 10);
    this.totalFocusMinutes = parseInt(localStorage.getItem('zenpulse_focus_min') || '0', 10);

    // SVG Circular calculations (r = 140)
    this.circleCircumference = 2 * Math.PI * 140; // ~879.64

    // Elements
    this.timerReadout = document.getElementById('timerReadout');
    this.sessionLabel = document.getElementById('sessionLabel');
    this.subStatus = document.getElementById('subStatus');
    this.progressCircle = document.getElementById('timerProgressCircle');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.playIcon = document.getElementById('playIcon');
    this.pauseIcon = document.getElementById('pauseIcon');
    this.resetBtn = document.getElementById('resetBtn');
    this.skipBtn = document.getElementById('skipBtn');
    this.modeButtons = document.querySelectorAll('.mode-btn');
    this.sessionsCountEl = document.getElementById('completedSessionsCount');
    this.focusMinutesEl = document.getElementById('totalFocusMinutes');

    this.init();
  }

  init() {
    this.updateStatsDisplay();
    this.updateDisplay();
    this.bindEvents();

    // Request notification permission if supported
    if ('Notification' in window && Notification.permission === 'default') {
      // Prompt gracefully on user gesture
    }
  }

  bindEvents() {
    // Mode Switcher Buttons
    this.modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.setMode(mode);
      });
    });

    // Play/Pause Button
    this.playPauseBtn.addEventListener('click', () => this.togglePlay());

    // Reset Button
    this.resetBtn.addEventListener('click', () => this.resetTimer());

    // Skip Button
    this.skipBtn.addEventListener('click', () => this.skipSession());
  }

  setMode(mode) {
    if (!this.modes[mode]) return;
    this.pause();
    this.currentMode = mode;
    this.totalDuration = this.modes[mode].duration;
    this.remainingSeconds = this.totalDuration;

    // Update active mode tab button
    this.modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    this.sessionLabel.textContent = this.modes[mode].name;
    this.subStatus.textContent = 'Space to Start';
    this.updateDisplay();
  }

  togglePlay() {
    // Initialize audio context if not already active
    if (window.zenAudio) {
      window.zenAudio.init();
    }

    if (this.isRunning) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = Date.now();

    // Trigger ambient audio when timer starts
    if (window.zenAudio) {
      window.zenAudio.onTimerStateChange(true);
    }

    this.playIcon.classList.add('hidden');
    this.pauseIcon.classList.remove('hidden');
    this.subStatus.textContent = 'Focusing...';

    // Interval loop with drift correction
    this.timerInterval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - this.lastTimestamp) / 1000);

      if (deltaSeconds >= 1) {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - deltaSeconds);
        this.lastTimestamp = now;
        this.updateDisplay();

        if (this.remainingSeconds <= 0) {
          this.completeSession();
        }
      }
    }, 250);
  }

  pause() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop ambient audio when timer pauses
    if (window.zenAudio) {
      window.zenAudio.onTimerStateChange(false);
    }

    this.playIcon.classList.remove('hidden');
    this.pauseIcon.classList.add('hidden');
    this.subStatus.textContent = 'Paused';
  }

  resetTimer() {
    this.pause();
    if (window.zenAudio) {
      window.zenAudio.onTimerStateChange(false);
    }
    this.remainingSeconds = this.totalDuration;
    this.subStatus.textContent = 'Ready';
    this.updateDisplay();
  }

  skipSession() {
    this.pause();
    if (this.currentMode === 'focus') {
      this.setMode('shortBreak');
    } else {
      this.setMode('focus');
    }
  }

  completeSession() {
    this.pause();

    // Play chime sound & visual wave
    if (window.zenAudio) {
      window.zenAudio.playSessionChime();
    }
    if (window.zenVisualizer) {
      window.zenVisualizer.emitRipple();
    }

    // Update stats if it was a focus session
    if (this.currentMode === 'focus') {
      this.completedSessions += 1;
      this.totalFocusMinutes += Math.round(this.totalDuration / 60);
      localStorage.setItem('zenpulse_sessions', this.completedSessions);
      localStorage.setItem('zenpulse_focus_min', this.totalFocusMinutes);
      this.updateStatsDisplay();

      // Switch to break
      this.subStatus.textContent = 'Session Complete! Take a break.';
      setTimeout(() => {
        if (this.completedSessions % 4 === 0) {
          this.setMode('longBreak');
        } else {
          this.setMode('shortBreak');
        }
      }, 2000);
    } else {
      this.subStatus.textContent = 'Break finished! Ready to focus.';
      setTimeout(() => {
        this.setMode('focus');
      }, 2000);
    }

    // Send Browser Notification
    this.sendNotification();
  }

  sendNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = this.currentMode === 'focus' ? '🎯 Focus Session Complete!' : '☕ Break Finished!';
      const body = this.currentMode === 'focus' ? 'Great work! Time for a refreshing break.' : 'Ready to resume your deep focus session?';
      new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%238b5cf6"/></svg>' });
    }
  }

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    this.timerReadout.textContent = formatted;

    // Document Title
    document.title = this.isRunning ? `(${formatted}) ZenPulse` : 'ZenPulse — Ambient Soundscape & Focus Studio';

    // SVG Progress Circle
    const progress = (this.totalDuration - this.remainingSeconds) / this.totalDuration;
    const offset = this.circleCircumference * (1 - progress);
    this.progressCircle.style.strokeDasharray = this.circleCircumference;
    this.progressCircle.style.strokeDashoffset = offset;
  }

  updateStatsDisplay() {
    if (this.sessionsCountEl) this.sessionsCountEl.textContent = this.completedSessions;
    if (this.focusMinutesEl) this.focusMinutesEl.textContent = this.totalFocusMinutes;
  }
}

// Global instance
document.addEventListener('DOMContentLoaded', () => {
  window.zenTimer = new PomodoroTimer();
});
