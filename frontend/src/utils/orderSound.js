export const playOrderSound = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.13);
    gain.gain.exponentialRampToValueAtTime(0.24, now + index * 0.13 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.13 + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + index * 0.13);
    oscillator.stop(now + index * 0.13 + 0.3);
  });

  setTimeout(() => context.close(), 1200);
};
