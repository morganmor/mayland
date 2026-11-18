import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { ThemeMode } from '../types/mayland';

interface MaylandStoragePlugin {
  loadState(): Promise<{ json: string | null }>;
  saveState(options: { json: string }): Promise<{ saved: boolean }>;
}

const MaylandStorage = registerPlugin<MaylandStoragePlugin>('MaylandStorage');

let hapticsGlobalEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsGlobalEnabled = enabled;
}

export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function triggerHaptic(
  strength: 'light' | 'medium' = 'light'
): Promise<void> {
  if (!hapticsGlobalEnabled) return;
  if (isNativeMobile()) {
    try {
      await Haptics.impact({
        style: strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
      return;
    } catch {
      // fall through
    }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(strength === 'medium' ? 14 : 7);
    } catch {
      // ignore vibration block
    }
  }
}

const THEME_STATUS_BG: Record<ThemeMode, string> = {
  dark: '#13161C',
  obsidian: '#0B0D12',
  'space-adventure': '#0B1022',
  'space-night': '#07080D',
  light: '#F5F7FA',
};

export async function syncNativeStatusBar(theme: ThemeMode): Promise<void> {
  if (!isNativeMobile()) return;
  try {
    await StatusBar.setStyle({
      style: theme === 'light' ? Style.Light : Style.Dark,
    });
    await StatusBar.setBackgroundColor({ color: THEME_STATUS_BG[theme] });
  } catch {
    // ignore in unsupported webview
  }
}

export function registerAndroidBackHandler(onBack: () => boolean): () => void {
  if (!isNativeMobile()) return () => undefined;
  let removed = false;
  let handleRef: { remove: () => Promise<void> } | null = null;

  CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBack();
    if (!handled && !canGoBack) {
      CapApp.minimizeApp();
    }
  })
    .then((handle) => {
      if (removed) {
        handle.remove();
      } else {
        handleRef = handle;
      }
    })
    .catch(() => undefined);

  return () => {
    removed = true;
    handleRef?.remove().catch(() => undefined);
  };
}

export async function loadNativeWorkspaceState(): Promise<string | null> {
  if (!isNativeMobile()) return null;
  try {
    const res = await MaylandStorage.loadState();
    return typeof res?.json === 'string' && res.json.trim() ? res.json : null;
  } catch {
    return null;
  }
}

export async function saveNativeWorkspaceState(json: string): Promise<boolean> {
  if (!isNativeMobile()) return false;
  try {
    const res = await MaylandStorage.saveState({ json });
    return Boolean(res?.saved);
  } catch {
    return false;
  }
}
