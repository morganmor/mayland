import { describe, expect, it } from 'vitest';
import { createDefaultProfiles } from '../adapters/providerPresets';
import {
  isPristineWorkspace,
  mergeWorkspacesForFirstSync,
  type WorkspaceSyncState,
} from './workspaceSync';

describe('workspaceSync merge & pristine detection', () => {
  it('treats untouched default profiles with empty playground as pristine', () => {
    const defaults = createDefaultProfiles();
    expect(
      isPristineWorkspace({
        profiles: defaults,
        conversations: [
          {
            id: 'c1',
            title: 'Playground',
            messages: [],
            settings: {
              profileId: defaults[0].id,
              model: defaults[0].defaultModel,
              systemInstructions: '',
              thinkingEffort: 'high',
              temperature: 0.7,
              topP: 0.95,
              maxTokens: null,
              jsonMode: false,
              hapticsEnabled: true,
              autoScroll: true,
            },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        theme: 'dark',
        envelopesCount: 0,
      })
    ).toBe(true);
  });

  it('merges custom profiles and conversations across browser profiles without losing either', () => {
    const defaults = createDefaultProfiles();
    const deepseek = {
      ...defaults[0],
      id: 'custom-deepseek',
      name: 'Deepseek',
      baseUrl: 'https://quality-biological-dive-represented.trycloudflare.com/v1',
      defaultModel: 'deepseek-v4.1',
      preset: 'custom' as const,
      requiresApiKey: false,
    };
    const strata = {
      ...defaults[0],
      id: 'custom-strata',
      name: 'Strata',
      baseUrl: 'https://other.trycloudflare.com/v1',
      defaultModel: 'deepseek-v4.1',
      preset: 'custom' as const,
      requiresApiKey: false,
    };

    const remote: WorkspaceSyncState = {
      version: 1,
      profiles: [...defaults, deepseek],
      conversations: [
        {
          id: 'conv-remote',
          title: 'Deepseek session',
          messages: [{ id: 'm1', role: 'user', content: 'Halo', createdAt: 10 }],
          settings: {
            profileId: deepseek.id,
            model: 'deepseek-v4.1',
            systemInstructions: '',
            thinkingEffort: 'max',
            temperature: 0.7,
            topP: 0.95,
            maxTokens: null,
            jsonMode: false,
            hapticsEnabled: true,
            autoScroll: true,
          },
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      activeConvId: 'conv-remote',
      theme: 'space-adventure',
      proseFont: 'editorial',
      vault: { envelopes: {}, pinConfig: null },
      updatedAt: 20,
    };

    const local: WorkspaceSyncState = {
      version: 1,
      profiles: [...defaults, strata],
      conversations: [
        {
          id: 'conv-empty',
          title: 'Playground',
          messages: [],
          settings: remote.conversations[0].settings,
          createdAt: 5,
          updatedAt: 5,
        },
      ],
      activeConvId: 'conv-empty',
      theme: 'dark',
      proseFont: 'editorial',
      vault: { envelopes: {}, pinConfig: null },
      updatedAt: 5,
    };

    const merged = mergeWorkspacesForFirstSync(remote, local);
    expect(merged.profiles.map((p) => p.name)).toContain('Deepseek');
    expect(merged.profiles.map((p) => p.name)).toContain('Strata');
    expect(merged.conversations.map((c) => c.id)).toEqual(['conv-remote']);
    expect(merged.theme).toBe('space-adventure');
  });
});
