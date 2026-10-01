import { RESOLUTIONS, Resolution } from '../config/layout';

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  fullscreen: boolean;
  resolution: Resolution;
}

const KEY = 'godoflegacy.settings';

const DEFAULTS: GameSettings = {
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 90,
  fullscreen: false,
  resolution: '1920x1080',
};

const clamp = (v: unknown, d: number) =>
  typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d;

class Store {
  private data: GameSettings = { ...DEFAULTS };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<GameSettings>;
        this.data = {
          masterVolume: clamp(p.masterVolume, DEFAULTS.masterVolume),
          musicVolume: clamp(p.musicVolume, DEFAULTS.musicVolume),
          sfxVolume: clamp(p.sfxVolume, DEFAULTS.sfxVolume),
          fullscreen: typeof p.fullscreen === 'boolean' ? p.fullscreen : DEFAULTS.fullscreen,
          resolution: RESOLUTIONS.includes(p.resolution as Resolution) ? (p.resolution as Resolution) : DEFAULTS.resolution,
        };
      }
    } catch { /* storage unavailable: keep defaults */ }
  }

  get(): Readonly<GameSettings> {
    return this.data;
  }

  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.data = { ...this.data, [key]: value };
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}

export const SettingsStore = new Store();
