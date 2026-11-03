import type { AudioOptions, AudioProvider, HapticsOption, SoundKey } from '../types';
import { SynthAudio } from './synth';

export interface Feedback {
  sound(key: SoundKey, tier?: number): void;
  buzz(pattern: number | number[]): void;
  unlock(): void;
  update(options: Pick<AudioOptions, 'enabled' | 'volume'>): void;
  dispose(): void;
}

const silent: AudioProvider = { play: () => undefined };

/** Une sonido y háptica detrás de una sola interfaz para el render. */
export function createFeedback(audio: AudioOptions = {}, haptics: HapticsOption = true): Feedback {
  const provider: AudioProvider =
    audio.provider === 'none'
      ? silent
      : typeof audio.provider === 'object'
        ? audio.provider
        : new SynthAudio({ volume: audio.volume ?? 0.7, enabled: audio.enabled ?? true });

  if (typeof audio.provider === 'object') {
    provider.setVolume?.(audio.volume ?? 0.7);
    provider.setEnabled?.(audio.enabled ?? true);
  }

  let enabled = audio.enabled ?? true;

  const vibrate = (pattern: number | number[]): void => {
    if (haptics === false) {
      return;
    }
    if (typeof haptics === 'object') {
      haptics.vibrate(pattern);
      return;
    }
    const nav = globalThis.navigator as Navigator | undefined;
    nav?.vibrate?.(pattern);
  };

  return {
    sound(key, tier) {
      if (!enabled) {
        return;
      }
      const custom = audio.sounds?.[key];
      if (custom) {
        custom();
        return;
      }
      provider.play(key, tier === undefined ? {} : { tier });
    },
    buzz: vibrate,
    unlock: () => provider.unlock?.(),
    update(next) {
      if (next.enabled !== undefined) {
        enabled = next.enabled;
        provider.setEnabled?.(next.enabled);
      }
      if (next.volume !== undefined) {
        provider.setVolume?.(next.volume);
      }
    },
    dispose: () => provider.dispose?.(),
  };
}
