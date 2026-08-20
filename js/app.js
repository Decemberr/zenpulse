/**
 * ZenPulse — Master Orchestration, Themes, Controls & Shortcuts
 */

document.addEventListener('DOMContentLoaded', () => {
  const audio = window.zenAudio;
  const timer = window.zenTimer;

  // DOM Elements
  const masterAudioBtn = document.getElementById('masterAudioBtn');
  const audioIconOn = document.getElementById('audioIconOn');
  const audioIconOff = document.getElementById('audioIconOff');
  const masterVolumeSlider = document.getElementById('masterVolume');
  const trackElements = document.querySelectorAll('.sound-track-item');
  const presetChips = document.querySelectorAll('.preset-chip');
  const themeBtn = document.getElementById('themeBtn');
  const themeDropdown = themeBtn?.closest('.dropdown-wrapper');
  const themeOptions = document.querySelectorAll('.theme-option');
  const zenToggleBtn = document.getElementById('zenToggleBtn');
  const zenExitBtn = document.getElementById('zenExitBtn');

  // ==========================================
  // 1. Sound Track Controls & UI Synchronization
  // ==========================================

  // Per-track toggle & sliders
  trackElements.forEach(trackEl => {
    const soundKey = trackEl.dataset.sound;
    const toggleBtn = trackEl.querySelector('.track-toggle-btn');
    const slider = trackEl.querySelector('.sound-slider');
    const volumeVal = trackEl.querySelector('.volume-val');

    // Toggle button click
    toggleBtn.addEventListener('click', () => {
      const isActive = audio.toggleTrack(soundKey);
      syncTrackUI(trackEl, isActive, audio.tracks[soundKey].volume);
    });

    // Volume Slider input
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      audio.setTrackVolume(soundKey, val);
      volumeVal.textContent = `${Math.round(val * 100)}%`;

      if (val > 0 && !audio.tracks[soundKey].active) {
        audio.toggleTrack(soundKey);
        syncTrackUI(trackEl, true, val);
      } else if (val === 0 && audio.tracks[soundKey].active) {
        audio.toggleTrack(soundKey);
        syncTrackUI(trackEl, false, val);
      }
    });
  });

  function syncTrackUI(trackEl, isActive, volume) {
    const toggleBtn = trackEl.querySelector('.track-toggle-btn');
    const slider = trackEl.querySelector('.sound-slider');
    const volumeVal = trackEl.querySelector('.volume-val');

    trackEl.classList.toggle('active', isActive);
    toggleBtn.classList.toggle('active', isActive);
    slider.value = volume;
    volumeVal.textContent = `${Math.round(volume * 100)}%`;
  }

  function syncAllTracksUI() {
    trackElements.forEach(trackEl => {
      const soundKey = trackEl.dataset.sound;
      const trackState = audio.tracks[soundKey];
      syncTrackUI(trackEl, trackState.active, trackState.volume);
    });
  }

  // Master Volume Slider
  masterVolumeSlider.addEventListener('input', (e) => {
    audio.setMasterVolume(e.target.value);
  });

  // Master Audio On/Off Button
  masterAudioBtn.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    audioIconOn.classList.toggle('hidden', isMuted);
    audioIconOff.classList.toggle('hidden', !isMuted);
  });

  // ==========================================
  // 2. Presets Manager
  // ==========================================
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const presetKey = chip.dataset.preset;
      
      presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      audio.applyPreset(presetKey);
      syncAllTracksUI();
    });
  });

  // ==========================================
  // 3. Theme Engine
  // ==========================================
  const savedTheme = localStorage.getItem('zenpulse_theme') || 'midnight';
  applyTheme(savedTheme);

  // Toggle Dropdown
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (themeDropdown && !themeDropdown.contains(e.target)) {
      themeDropdown.classList.remove('open');
    }
  });

  themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      applyTheme(theme);
      themeDropdown.classList.remove('open');
    });
  });

  function applyTheme(themeKey) {
    document.documentElement.dataset.theme = themeKey;
    localStorage.setItem('zenpulse_theme', themeKey);

    themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === themeKey);
    });
  }

  // ==========================================
  // 4. Zen Mode (Distraction-Free Focus)
  // ==========================================
  function toggleZenMode() {
    const isZen = document.body.classList.toggle('zen-mode');
    zenExitBtn.classList.toggle('hidden', !isZen);
  }

  zenToggleBtn.addEventListener('click', toggleZenMode);
  zenExitBtn.addEventListener('click', toggleZenMode);

  // ==========================================
  // 5. Global Keyboard Shortcuts
  // ==========================================
  document.addEventListener('keydown', (e) => {
    // Ignore shortcuts when typing in an input
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (window.zenTimer) {
        window.zenTimer.togglePlay();
      }
    } else if (e.key === 'm' || e.key === 'M') {
      masterAudioBtn.click();
    } else if (e.key === 'z' || e.key === 'Z') {
      toggleZenMode();
    } else if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
      toggleZenMode();
    } else if (e.key >= '1' && e.key <= '4') {
      const presetMap = { '1': 'study', '2': 'rainy-cabin', '3': 'campfire', '4': 'waves' };
      const presetKey = presetMap[e.key];
      const targetChip = document.querySelector(`.preset-chip[data-preset="${presetKey}"]`);
      if (targetChip) targetChip.click();
    }
  });

  // Initial sound sync
  syncAllTracksUI();
});
