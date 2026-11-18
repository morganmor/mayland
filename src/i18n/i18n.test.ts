import { describe, expect, it } from 'vitest';
import { getTranslations, LANGUAGE_OPTIONS } from './index';
import { loadLanguage, saveLanguage } from '../store/maylandStore';

describe('i18n bilingual support (en & id)', () => {
  it('supports only English and Bahasa Indonesia in settings options', () => {
    expect(LANGUAGE_OPTIONS.map((opt) => opt.id)).toEqual(['en', 'id']);
  });

  it('provides complete matching translation bundles for en and id', () => {
    const en = getTranslations('en');
    const id = getTranslations('id');

    expect(en.settings.title).toBe('Settings');
    expect(id.settings.title).toBe('Pengaturan');
    expect(id.composer.uploadFiles).toBe('Unggah Berkas');
    expect(id.composer.uploadImage).toBe('Unggah Gambar');
    expect(id.runSettings.maxOutputTokens).toBe('Maks token output');

    // Top-level domain keys must match identically
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
    expect(en.emptyState.starters).toHaveLength(4);
    expect(id.emptyState.starters).toHaveLength(4);
  });

  it('falls back safely to English and persists Indonesian selection when storage exists', () => {
    expect(loadLanguage()).toBe('en');

    const map = new Map<string, string>();
    const prevStorage = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      },
    });

    try {
      saveLanguage('id');
      expect(loadLanguage()).toBe('id');
      saveLanguage('en');
      expect(loadLanguage()).toBe('en');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: prevStorage,
      });
    }
  });
});
