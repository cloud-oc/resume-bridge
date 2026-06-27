import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const THEME_KEY = 'resumeBridgeThemeMode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const subscribers = new Set<() => void>();
let currentThemeMode: ThemeMode = 'system';
let initialized = false;
let mediaQuery: MediaQueryList | null = null;

export const themeOptions: { mode: ThemeMode; labelKey: string }[] = [
  { mode: 'system', labelKey: 'appearance.system' },
  { mode: 'light', labelKey: 'appearance.light' },
  { mode: 'dark', labelKey: 'appearance.dark' },
];

function getChromeStorage() {
  return globalThis.chrome?.storage?.local;
}

function normalizeThemeMode(value: unknown): ThemeMode | null {
  return value === 'system' || value === 'light' || value === 'dark' ? value : null;
}

function getSystemTheme(): EffectiveTheme {
  if (typeof globalThis.matchMedia !== 'function') return 'light';
  return globalThis.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(mode: ThemeMode): EffectiveTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

function writeFallbackThemeMode(mode: ThemeMode) {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, mode);
  } catch {
    // Ignore preview storage failures.
  }
}

function readFallbackThemeMode(): ThemeMode | null {
  try {
    return normalizeThemeMode(globalThis.localStorage?.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

function applyTheme(mode: ThemeMode) {
  const root = globalThis.document?.documentElement;
  if (!root) return;

  const effectiveTheme = resolveEffectiveTheme(mode);
  root.dataset.themeMode = mode;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;
}

function notify() {
  applyTheme(currentThemeMode);
  subscribers.forEach((subscriber) => subscriber());
}

async function readStoredThemeMode(): Promise<ThemeMode> {
  const storage = getChromeStorage();
  if (!storage) return readFallbackThemeMode() ?? 'system';

  return new Promise((resolve) => {
    storage.get(THEME_KEY, (result) => {
      if (globalThis.chrome?.runtime?.lastError) {
        resolve(readFallbackThemeMode() ?? 'system');
        return;
      }
      resolve(normalizeThemeMode(result?.[THEME_KEY]) ?? readFallbackThemeMode() ?? 'system');
    });
  });
}

async function writeStoredThemeMode(mode: ThemeMode): Promise<void> {
  writeFallbackThemeMode(mode);
  const storage = getChromeStorage();
  if (!storage) return;

  await new Promise<void>((resolve) => {
    storage.set({ [THEME_KEY]: mode }, () => resolve());
  });
}

function ensureMediaListener() {
  if (mediaQuery || typeof globalThis.matchMedia !== 'function') return;

  mediaQuery = globalThis.matchMedia(DARK_QUERY);
  mediaQuery.addEventListener?.('change', notify);
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  ensureMediaListener();

  if (!initialized) {
    initialized = true;
    applyTheme(currentThemeMode);
    void readStoredThemeMode().then((mode) => {
      currentThemeMode = mode;
      notify();
    });
  }

  return () => subscribers.delete(callback);
}

function getSnapshot() {
  return `${currentThemeMode}:${resolveEffectiveTheme(currentThemeMode)}`;
}

export function initializeTheme() {
  ensureMediaListener();
  applyTheme(currentThemeMode);
  if (!initialized) {
    initialized = true;
    void readStoredThemeMode().then((mode) => {
      currentThemeMode = mode;
      notify();
    });
  }
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [themeMode, effectiveTheme] = snapshot.split(':') as [ThemeMode, EffectiveTheme];

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode, effectiveTheme]);

  const setThemeMode = useCallback(async (nextMode: ThemeMode) => {
    currentThemeMode = nextMode;
    notify();
    await writeStoredThemeMode(nextMode);
  }, []);

  return useMemo(
    () => ({ themeMode, effectiveTheme, setThemeMode }),
    [themeMode, effectiveTheme, setThemeMode]
  );
}
