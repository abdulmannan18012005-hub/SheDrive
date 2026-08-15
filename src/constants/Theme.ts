import Colors from './Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface FontScale {
  scale: number;
  label: string;
}

export const FONT_SCALES: FontScale[] = [
  { scale: 0.85, label: 'Small' },
  { scale: 1.0, label: 'Normal' },
  { scale: 1.15, label: 'Large' },
  { scale: 1.3, label: 'Extra Large' },
];

export const BASE_FONT_SIZES = {
  // Headings
  h1: 32,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  h6: 14,

  // Body
  body: 15,
  bodySmall: 13,
  bodyTiny: 11,

  // UI
  caption: 12,
  overline: 10,

  // Special
  button: 16,
  input: 15,
};

export const BASE_FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const BASE_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export class Theme {
  private mode: ThemeMode = 'light';
  private fontScale: number = 1.0;

  constructor() {
    this.loadPreferences();
  }

  setMode(mode: ThemeMode): void {
    this.mode = mode;
    this.savePreferences();
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  setFontScale(scale: number): void {
    this.fontScale = scale;
    this.savePreferences();
  }

  getFontScale(): number {
    return this.fontScale;
  }

  get colors() {
    return Colors[this.mode];
  }

  get fontSizes() {
    const scaled: Partial<typeof BASE_FONT_SIZES> = {};
    Object.entries(BASE_FONT_SIZES).forEach(([key, value]) => {
      scaled[key as keyof typeof BASE_FONT_SIZES] = value * this.fontScale;
    });
    return scaled as typeof BASE_FONT_SIZES;
  }

  get fontWeights() {
    return BASE_FONT_WEIGHTS;
  }

  get spacing() {
    return BASE_SPACING;
  }

  get borderRadius() {
    return BORDER_RADIUS;
  }

  toggleMode(): void {
    this.mode = this.mode === 'light' ? 'dark' : 'light';
    this.savePreferences();
  }

  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem('@shedrive_theme_preferences', JSON.stringify({
        mode: this.mode,
        fontScale: this.fontScale,
      }));
    } catch (error) {
      console.error('Error saving theme preferences:', error);
    }
  }

  private async loadPreferences(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('@shedrive_theme_preferences');
      if (data) {
        const preferences = JSON.parse(data);
        this.mode = preferences.mode || 'light';
        this.fontScale = preferences.fontScale || 1.0;
      }
    } catch (error) {
      console.error('Error loading theme preferences:', error);
    }
  }

  reset(): void {
    this.mode = 'light';
    this.fontScale = 1.0;
    this.savePreferences();
  }
}

export default new Theme();
