import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { X } from 'lucide-react';
import { openAIAdapter } from './adapters/openaiCompatible';
import { getSearchProviderSpec } from './adapters/searchProviders';
import { ComposerDock } from './components/ComposerDock';
import { GetCodeSheet } from './components/GetCodeSheet';
import { HistoryVaultDrawer } from './components/HistoryVaultDrawer';
import { MessageList } from './components/MessageList';
import { ModelPickerSheet } from './components/ModelPickerSheet';
import { PinUnlockOverlay } from './components/PinUnlockOverlay';
import { ProviderVaultSheet } from './components/ProviderVaultSheet';
import { RunSettingsDrawer } from './components/RunSettingsDrawer';
import { SavedPromptsModal } from './components/SavedPromptsModal';
import { SettingsModal, type SettingsSection } from './components/SettingsModal';
import { SpaceBackdrop } from './components/SpaceBackdrop';
import { TopBar } from './components/TopBar';
import { WebSearchSheet } from './components/WebSearchSheet';
import { keyVault, KeyVaultError } from './crypto/keyVault';
import { searchKeyStore, type SearchVaultInfo } from './crypto/searchKeyStore';
import {
  createDefaultSettings,
  createNewConversation,
  loadConversations,
  loadProfiles,
  loadProseFont,
  loadSavedPrompts,
  loadSearchEngineConfig,
  loadTheme,
  saveConversations,
  saveProfiles,
  saveProseFont,
  saveSavedPrompts,
  saveSearchEngineConfig,
  saveTheme,
  THEME_OPTIONS,
} from './store/maylandStore';
import {
  buildCurrentWorkspaceSnapshot,
  fetchWorkspaceMeta,
  getRemoteSyncUrl,
  getStoredSyncedRev,
  isPristineWorkspace,
  loadNativeStoredWorkspace,
  mergeWorkspacesForFirstSync,
  pullWorkspaceFromEndpoint,
  pushWorkspaceToTarget,
  setRemoteSyncUrl,
  setStoredSyncedRev,
  type SyncStatusInfo,
  type WorkspaceSyncState,
} from './store/workspaceSync';
import type {
  Attachment,
  ChatMessage,
  Conversation,
  EnvelopeMetadata,
  MaybotMood,
  ProviderProfile,
  RequestPhase,
  RunSettings,
  SavedSystemPrompt,
  SearchEngineConfig,
  SearchKeyMetadata,
  SearchProviderId,
  ThemeMode,
  VaultStatus,
} from './types/mayland';
import {
  isNativeMobile,
  registerAndroidBackHandler,
  setHapticsEnabled,
  syncNativeStatusBar,
  triggerHaptic,
} from './utils/nativeBridge';
import { estimateTextTokens } from './utils/tokenEstimator';

interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

const SwipeableToast: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const dragRef = useRef<{
    id: number | null;
    startX: number;
    startY: number;
  }>({ id: null, startX: 0, startY: 0 });
  const [offset, setOffset] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const dragDistance = Math.max(Math.abs(offset.x), Math.max(0, -offset.y));
  const dragOpacity = offset.active ? Math.max(0.25, 1 - dragDistance / 110) : 1;

  return (
    <motion.div
      className="toast-pill"
      data-tone={toast.tone}
      data-dragging={offset.active ? 'true' : 'false'}
      initial={{ opacity: 0, y: -12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.94 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        opacity: dragOpacity,
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > 4 || Math.abs(e.deltaX) > 4) {
          onDismiss(toast.id);
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        dragRef.current = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore if capture unavailable
        }
        setOffset({ x: 0, y: 0, active: true });
      }}
      onPointerMove={(e) => {
        if (dragRef.current.id !== e.pointerId) return;
        const dx = e.clientX - dragRef.current.startX;
        const rawDy = e.clientY - dragRef.current.startY;
        const dy = rawDy > 0 ? Math.min(18, rawDy * 0.28) : rawDy;
        setOffset({ x: dx, y: dy, active: true });
      }}
      onPointerUp={(e) => {
        if (dragRef.current.id !== e.pointerId) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        dragRef.current.id = null;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
        if (Math.abs(dx) > 40 || dy < -26) {
          onDismiss(toast.id);
        } else {
          setOffset({ x: 0, y: 0, active: false });
        }
      }}
      onPointerCancel={(e) => {
        if (dragRef.current.id !== e.pointerId) return;
        dragRef.current.id = null;
        setOffset({ x: 0, y: 0, active: false });
      }}
    >
      <span className="toast-pill-msg">{toast.message}</span>
      <div className="toast-pill-actions">
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            className="toast-action-btn"
            onClick={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          type="button"
          className="toast-close-btn"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
};

const THEME_CYCLE: ThemeMode[] = THEME_OPTIONS.map((t) => t.id);

const msgTokenCache = new WeakMap<ChatMessage, number>();

function estimateAttachmentTokens(att: Attachment): number {
  if (att.kind === 'image') return 256;
  if (att.kind === 'text' && att.textContent) return estimateTextTokens(att.textContent);
  if (att.kind === 'file') {
    const isPdf =
      att.mimeType.toLowerCase() === 'application/pdf' ||
      att.name.toLowerCase().endsWith('.pdf');
    return isPdf ? 512 : 64;
  }
  return 0;
}

function getCachedMessageTokens(msg: ChatMessage): number {
  const cached = msgTokenCache.get(msg);
  if (cached !== undefined) return cached;
  let total = 4;
  if (
    msg.role === 'assistant' &&
    msg.metrics &&
    !msg.metrics.estimated &&
    msg.metrics.completionTokens > 0
  ) {
    total += msg.metrics.completionTokens;
  } else {
    total += estimateTextTokens(msg.content);
    if (msg.thinking) {
      total += estimateTextTokens(msg.thinking);
    }
  }
  if (msg.attachments) {
    for (const att of msg.attachments) {
      total += estimateAttachmentTokens(att);
    }
  }
  msgTokenCache.set(msg, total);
  return total;
}

export function App() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>(() => loadProfiles());
  const initialData = useMemo(() => loadConversations(profiles[0]), []);
  const [conversations, setConversations] = useState<Conversation[]>(
    initialData.conversations
  );
  const [activeConvId, setActiveConvId] = useState<string>(initialData.activeId);

  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [proseFont, setProseFont] = useState<'editorial' | 'clean'>(() =>
    loadProseFont()
  );
  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>(() =>
    loadSavedPrompts()
  );

  const [vaultStatus, setVaultStatus] = useState<VaultStatus>(() =>
    keyVault.getVaultStatus()
  );
  const [envelopesMeta, setEnvelopesMeta] = useState<
    Record<string, EnvelopeMetadata>
  >(() => keyVault.listAllMetadata());

  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [isTyping, setIsTyping] = useState(false);
  const [happyBurst, setHappyBurst] = useState(false);
  const [liveTokPerSec, setLiveTokPerSec] = useState<number | undefined>(
    undefined
  );

  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [appSettingsSection, setAppSettingsSection] =
    useState<SettingsSection>('appearance');
  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [getCodeOpen, setGetCodeOpen] = useState(false);
  const [savedPromptsOpen, setSavedPromptsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [vaultVersion, setVaultVersion] = useState(0);
  const [searchConfig, setSearchConfig] = useState<SearchEngineConfig>(() =>
    loadSearchEngineConfig()
  );
  const [searchKeyMetadata, setSearchKeyMetadata] = useState<
    Partial<Record<SearchProviderId, SearchKeyMetadata>>
  >({});
  const [searchVaultInfo, setSearchVaultInfo] = useState<SearchVaultInfo>(() => ({
    backend: isNativeMobile() ? 'android-keystore' : 'webcrypto-vault',
    hardwareBacked: false,
    algorithm: isNativeMobile()
      ? 'AndroidKeyStore AES-256-GCM'
      : 'WebCrypto AES-256-GCM',
    keyCount: 0,
  }));
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(() => ({
    mode: isNativeMobile() ? 'android-native' : 'disk',
    rev: getStoredSyncedRev(),
    updatedAt: 0,
    lanUrls: [],
    remoteSyncUrl: getRemoteSyncUrl(),
  }));

  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const preferredJwkRef = useRef<JsonWebKey | null | undefined>(undefined);

  const activeConv =
    conversations.find((c) => c.id === activeConvId) ?? conversations[0];

  const activeProfile =
    profiles.find((p) => p.id === activeConv.settings.profileId) ?? profiles[0];

  const hasActiveKey = Boolean(envelopesMeta[activeProfile.id]);
  const hasActiveSearchKey = Boolean(searchKeyMetadata[searchConfig.activeProviderId]);

  const refreshSearchVault = useCallback(async () => {
    try {
      const [meta, info] = await Promise.all([
        searchKeyStore.listMetadata(),
        searchKeyStore.getVaultInfo(),
      ]);
      setSearchKeyMetadata(meta);
      setSearchVaultInfo(info);
    } catch {
      // ignore search vault inspection errors
    }
  }, []);

  const refreshVault = useCallback(() => {
    setVaultStatus(keyVault.getVaultStatus());
    setEnvelopesMeta(keyVault.listAllMetadata());
    setVaultVersion((v) => v + 1);
    void refreshSearchVault();
  }, [refreshSearchVault]);

  const openAppSettings = useCallback((section: SettingsSection = 'appearance') => {
    setAppSettingsSection(section);
    setAppSettingsOpen(true);
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      tone: 'info' | 'error' = 'info',
      action?: { label: string; run: () => void }
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [
        ...prev.filter((t) => t.message !== message).slice(-2),
        {
          id,
          message,
          tone,
          actionLabel: action?.label,
          onAction: action?.run,
        },
      ]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, action ? 6000 : 4200);
    },
    []
  );

  const lastConvSaveAtRef = useRef(0);
  useEffect(() => {
    const isActiveStream =
      phase === 'decrypting' ||
      phase === 'connecting' ||
      phase === 'thinking' ||
      phase === 'streaming';
    if (!isActiveStream) {
      lastConvSaveAtRef.current = Date.now();
      saveConversations(conversations, activeConv.id);
      return undefined;
    }
    const elapsed = Date.now() - lastConvSaveAtRef.current;
    if (elapsed >= 2000) {
      lastConvSaveAtRef.current = Date.now();
      saveConversations(conversations, activeConv.id);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      lastConvSaveAtRef.current = Date.now();
      saveConversations(conversations, activeConv.id);
    }, 2000 - elapsed);
    return () => window.clearTimeout(timer);
  }, [conversations, activeConv.id, phase]);

  useEffect(() => {
    saveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
    syncNativeStatusBar(theme);
  }, [theme]);

  useEffect(() => {
    saveProseFont(proseFont);
  }, [proseFont]);

  useEffect(() => {
    saveSavedPrompts(savedPrompts);
  }, [savedPrompts]);

  useEffect(() => {
    saveSearchEngineConfig(searchConfig);
  }, [searchConfig]);

  useEffect(() => {
    void refreshSearchVault();
  }, [refreshSearchVault, vaultStatus.unlocked]);

  useEffect(() => {
    setHapticsEnabled(activeConv.settings.hapticsEnabled ?? true);
  }, [activeConv.settings.hapticsEnabled]);

  const applySyncedWorkspace = useCallback(
    async (remoteState: WorkspaceSyncState, nextRev?: number) => {
      applyingRemoteRef.current = true;
      try {
        if (remoteState.vault) {
          await keyVault.importSyncVault(remoteState.vault);
          if (remoteState.vault.deviceKeyJwk) {
            preferredJwkRef.current = remoteState.vault.deviceKeyJwk;
          }
        }
        if (Array.isArray(remoteState.profiles) && remoteState.profiles.length > 0) {
          saveProfiles(remoteState.profiles);
          setProfiles(remoteState.profiles);
        }
        if (Array.isArray(remoteState.conversations) && remoteState.conversations.length > 0) {
          const targetActive =
            remoteState.conversations.find((c) => c.id === remoteState.activeConvId)?.id ??
            remoteState.conversations[0].id;
          saveConversations(remoteState.conversations, targetActive);
          setConversations(remoteState.conversations);
          setActiveConvId(targetActive);
        }
        if (remoteState.theme) {
          saveTheme(remoteState.theme);
          setTheme(remoteState.theme);
        }
        if (remoteState.proseFont === 'editorial' || remoteState.proseFont === 'clean') {
          saveProseFont(remoteState.proseFont);
          setProseFont(remoteState.proseFont);
        }
        if (Array.isArray(remoteState.savedPrompts)) {
          saveSavedPrompts(remoteState.savedPrompts);
          setSavedPrompts(remoteState.savedPrompts);
        }
        if (remoteState.searchEngineConfig) {
          saveSearchEngineConfig(remoteState.searchEngineConfig);
          setSearchConfig(remoteState.searchEngineConfig);
        }
        if (typeof nextRev === 'number') {
          setStoredSyncedRev(nextRev);
        }
        setVaultStatus(keyVault.getVaultStatus());
        setEnvelopesMeta(keyVault.listAllMetadata());
        setSyncInfo((prev) => ({
          ...prev,
          rev: typeof nextRev === 'number' ? nextRev : prev.rev,
          updatedAt: remoteState.updatedAt || Date.now(),
        }));
      } finally {
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 120);
      }
    },
    []
  );

  // Startup hydration: prioritize persistent PC disk store / native Android file over isolated browser sandbox
  useEffect(() => {
    let cancelled = false;

    const runHydration = async () => {
      try {
        if (isNativeMobile()) {
          const nativeState = await loadNativeStoredWorkspace();
          if (!cancelled && nativeState) {
            await applySyncedWorkspace(nativeState);
          }
          if (!cancelled) {
            hydratedRef.current = true;
            setSyncInfo((prev) => ({
              ...prev,
              mode: 'android-native',
              updatedAt: nativeState?.updatedAt ?? prev.updatedAt,
            }));
          }
          return;
        }

        const remoteRes = await pullWorkspaceFromEndpoint();
        if (cancelled) return;

        if (!remoteRes) {
          hydratedRef.current = true;
          setSyncInfo((prev) => ({ ...prev, mode: 'browser-only' }));
          return;
        }

        const serverRev = remoteRes.rev ?? 0;
        const remoteState = remoteRes.state ?? null;
        const lanUrls = remoteRes.lanUrls ?? [];
        const storePath = remoteRes.storePath;

        const currentEnvelopesCount = Object.keys(keyVault.listAllMetadata()).length;
        const localPristine = isPristineWorkspace({
          profiles,
          conversations,
          theme,
          envelopesCount: currentEnvelopesCount,
          savedPromptsCount: savedPrompts.length,
        });
        const localRev = getStoredSyncedRev();

        if (remoteState && serverRev > 0) {
          if (localPristine || localRev > 0) {
            if (serverRev !== localRev || localPristine) {
              await applySyncedWorkspace(remoteState, serverRev);
            }
          } else {
            const localSnapshot = await buildCurrentWorkspaceSnapshot({
              profiles,
              conversations,
              activeConvId: activeConv.id,
              theme,
              proseFont,
              savedPrompts,
              searchEngineConfig: searchConfig,
              preferredJwk: remoteState.vault?.deviceKeyJwk,
            });
            const merged = mergeWorkspacesForFirstSync(remoteState, localSnapshot);
            const pushRes = await pushWorkspaceToTarget(merged);
            await applySyncedWorkspace(merged, pushRes.rev ?? serverRev);
          }
          setSyncInfo((prev) => ({
            ...prev,
            mode: 'disk',
            rev: getStoredSyncedRev() || serverRev,
            updatedAt: remoteRes.updatedAt ?? Date.now(),
            storePath,
            lanUrls,
          }));
        } else {
          if (!localPristine) {
            const initialSnapshot = await buildCurrentWorkspaceSnapshot({
              profiles,
              conversations,
              activeConvId: activeConv.id,
              theme,
              proseFont,
              savedPrompts,
              searchEngineConfig: searchConfig,
            });
            if (initialSnapshot.vault.deviceKeyJwk) {
              preferredJwkRef.current = initialSnapshot.vault.deviceKeyJwk;
            }
            const pushRes = await pushWorkspaceToTarget(initialSnapshot);
            setSyncInfo((prev) => ({
              ...prev,
              mode: 'disk',
              rev: pushRes.rev ?? 1,
              updatedAt: pushRes.updatedAt ?? Date.now(),
              storePath: pushRes.storePath ?? storePath,
              lanUrls,
            }));
          } else {
            setSyncInfo((prev) => ({
              ...prev,
              mode: 'disk',
              rev: serverRev,
              storePath,
              lanUrls,
            }));
          }
        }
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
        }
      }
    };

    runHydration();
    return () => {
      cancelled = true;
    };
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync mutations to PC disk store / Android native storage
  useEffect(() => {
    if (!hydratedRef.current || applyingRemoteRef.current) return;

    const currentEnvelopesCount = Object.keys(keyVault.listAllMetadata()).length;
    const localPristine = isPristineWorkspace({
      profiles,
      conversations,
      theme,
      envelopesCount: currentEnvelopesCount,
      savedPromptsCount: savedPrompts.length,
    });

    if (!isNativeMobile() && localPristine && getStoredSyncedRev() === 0) {
      return;
    }

    const delay = phase === 'idle' ? 280 : 1200;
    const timer = window.setTimeout(async () => {
      if (applyingRemoteRef.current) return;
      const snapshot = await buildCurrentWorkspaceSnapshot({
        profiles,
        conversations,
        activeConvId: activeConv.id,
        theme,
        proseFont,
        savedPrompts,
        searchEngineConfig: searchConfig,
        preferredJwk: preferredJwkRef.current,
      });
      if (snapshot.vault.deviceKeyJwk) {
        preferredJwkRef.current = snapshot.vault.deviceKeyJwk;
      }
      const res = await pushWorkspaceToTarget(snapshot);
      if (res.ok) {
        setSyncInfo((prev) => ({
          ...prev,
          rev: res.rev ?? prev.rev,
          updatedAt: res.updatedAt ?? Date.now(),
          storePath: res.storePath ?? prev.storePath,
        }));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [profiles, conversations, activeConv.id, activeConvId, theme, proseFont, savedPrompts, searchConfig, vaultVersion, phase]);

  // Listen for updates from other browser tabs / Chrome profiles
  useEffect(() => {
    if (isNativeMobile()) return undefined;

    const checkForUpdates = async () => {
      if (!hydratedRef.current || applyingRemoteRef.current || phase !== 'idle') {
        return;
      }
      const meta = await fetchWorkspaceMeta();
      if (!meta || typeof meta.rev !== 'number') return;
      if (meta.rev > getStoredSyncedRev() && meta.hasState) {
        const full = await pullWorkspaceFromEndpoint();
        if (full?.state && typeof full.rev === 'number') {
          await applySyncedWorkspace(full.state, full.rev);
          setSyncInfo((prev) => ({
            ...prev,
            rev: full.rev ?? prev.rev,
            updatedAt: full.updatedAt ?? Date.now(),
            storePath: full.storePath ?? prev.storePath,
            lanUrls: full.lanUrls ?? prev.lanUrls,
          }));
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('mayland-sync');
        channel.onmessage = () => {
          void checkForUpdates();
        };
      }
    } catch {
      // ignore
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };

    window.addEventListener('focus', checkForUpdates);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    }, 3000);

    return () => {
      channel?.close();
      window.removeEventListener('focus', checkForUpdates);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [applySyncedWorkspace, phase]);

  const handleSyncRemote = useCallback(
    async (remoteUrl: string, action: 'pull' | 'push') => {
      const cleaned = remoteUrl.trim().replace(/\/+$/, '');
      setRemoteSyncUrl(cleaned);
      setSyncInfo((prev) => ({ ...prev, remoteSyncUrl: cleaned }));
      const targetUrl = cleaned || undefined;

      if (action === 'pull') {
        const res = await pullWorkspaceFromEndpoint(targetUrl);
        if (!res?.state) {
          pushToast(
            cleaned
              ? `Could not pull from ${cleaned}`
              : 'No saved workspace on PC disk yet',
            'error'
          );
          return;
        }
        await applySyncedWorkspace(res.state, res.rev);
        setSyncInfo((prev) => ({
          ...prev,
          rev: res.rev ?? prev.rev,
          updatedAt: res.updatedAt ?? Date.now(),
          storePath: res.storePath ?? prev.storePath,
          lanUrls: res.lanUrls ?? prev.lanUrls,
        }));
        pushToast(`Synced workspace (${res.state.profiles.length} providers)`);
      } else {
        const snapshot = await buildCurrentWorkspaceSnapshot({
          profiles,
          conversations,
          activeConvId: activeConv.id,
          theme,
          proseFont,
          savedPrompts,
          searchEngineConfig: searchConfig,
          preferredJwk: preferredJwkRef.current,
        });
        if (snapshot.vault.deviceKeyJwk) {
          preferredJwkRef.current = snapshot.vault.deviceKeyJwk;
        }
        const res = await pushWorkspaceToTarget(snapshot, targetUrl);
        if (!res.ok) {
          pushToast(
            cleaned
              ? `Could not push to ${cleaned}`
              : 'Could not reach PC workspace store',
            'error'
          );
          return;
        }
        setSyncInfo((prev) => ({
          ...prev,
          rev: res.rev ?? prev.rev,
          updatedAt: res.updatedAt ?? Date.now(),
          storePath: res.storePath ?? prev.storePath,
        }));
        pushToast('Workspace synced');
      }
    },
    [activeConv.id, applySyncedWorkspace, conversations, profiles, proseFont, pushToast, savedPrompts, searchConfig, theme]
  );

  const handleExportBackup = useCallback(async () => {
    const snapshot = await buildCurrentWorkspaceSnapshot({
      profiles,
      conversations,
      activeConvId: activeConv.id,
      theme,
      proseFont,
      savedPrompts,
      searchEngineConfig: searchConfig,
      preferredJwk: preferredJwkRef.current,
    });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mayland-sync-${stamp}.mayland.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast('Exported portable workspace bundle');
  }, [activeConv.id, conversations, profiles, proseFont, pushToast, savedPrompts, searchConfig, theme]);

  const handleSaveSystemPrompt = useCallback(
    (name: string, content: string) => {
      const cleanedName = name.trim();
      if (!cleanedName || !content.trim()) return;
      const now = Date.now();
      setSavedPrompts((prev) => {
        const existingIdx = prev.findIndex(
          (p) => p.name.toLowerCase() === cleanedName.toLowerCase()
        );
        if (existingIdx >= 0) {
          return prev.map((p, i) =>
            i === existingIdx ? { ...p, name: cleanedName, content, updatedAt: now } : p
          );
        }
        return [
          {
            id: `sp-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: cleanedName,
            content,
            updatedAt: now,
          },
          ...prev,
        ];
      });
      pushToast(`Saved prompt "${cleanedName}"`);
    },
    [pushToast]
  );

  const handleDeleteSystemPrompt = useCallback(
    (id: string) => {
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
      pushToast('Deleted saved prompt');
    },
    [pushToast]
  );

  const handleImportBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as WorkspaceSyncState;
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
          throw new Error('Invalid Mayland backup format.');
        }
        await applySyncedWorkspace(parsed);
        const res = await pushWorkspaceToTarget(parsed);
        if (res.ok && typeof res.rev === 'number') {
          setStoredSyncedRev(res.rev);
          setSyncInfo((prev) => ({
            ...prev,
            rev: res.rev ?? prev.rev,
            updatedAt: res.updatedAt ?? Date.now(),
          }));
        }
        pushToast(`Imported ${parsed.profiles.length} providers & ${parsed.conversations.length} chats`);
      } catch (err) {
        pushToast((err as Error).message || 'Failed to import backup', 'error');
      }
    },
    [applySyncedWorkspace, pushToast]
  );

  useEffect(() => {
    return registerAndroidBackHandler(() => {
      if (webSearchOpen) {
        setWebSearchOpen(false);
        return true;
      }
      if (getCodeOpen) {
        setGetCodeOpen(false);
        return true;
      }
      if (modelPickerOpen) {
        setModelPickerOpen(false);
        return true;
      }
      if (vaultOpen) {
        setVaultOpen(false);
        return true;
      }
      if (appSettingsOpen) {
        setAppSettingsOpen(false);
        return true;
      }
      if (savedPromptsOpen) {
        setSavedPromptsOpen(false);
        return true;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (historyOpen) {
        setHistoryOpen(false);
        return true;
      }
      return false;
    });
  }, [
    webSearchOpen,
    getCodeOpen,
    modelPickerOpen,
    vaultOpen,
    appSettingsOpen,
    savedPromptsOpen,
    settingsOpen,
    historyOpen,
  ]);

  const updateActiveConversation = useCallback(
    (updater: (conv: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConv.id ? updater(c) : c))
      );
    },
    [activeConv.id]
  );

  const handleUpdateSettings = useCallback(
    (patch: Partial<RunSettings>) => {
      updateActiveConversation((conv) => ({
        ...conv,
        settings: { ...conv.settings, ...patch },
        updatedAt: Date.now(),
      }));
    },
    [updateActiveConversation]
  );

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    const created = createNewConversation(activeProfile);
    setConversations((prev) => [created, ...prev]);
    setActiveConvId(created.id);
    setPrompt('');
    setAttachments([]);
  }, [activeProfile]);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      const target = conversations.find((c) => c.id === id);
      if (!target || conversations.length <= 1) return;
      const idx = conversations.findIndex((c) => c.id === id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        setActiveConvId(remaining[0].id);
      }
      pushToast(`Deleted "${target.title}"`, 'info', {
        label: 'Undo',
        run: () => {
          setConversations((cur) => {
            if (cur.some((item) => item.id === target.id)) return cur;
            const copy = [...cur];
            copy.splice(Math.min(idx, copy.length), 0, target);
            return copy;
          });
          setActiveConvId(target.id);
        },
      });
    },
    [activeConvId, conversations, pushToast]
  );

  const dispatchChat = useCallback(
    async (historyForSend: ChatMessage[], assistantId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let latestTokPerSec: number | undefined;
      let dirtyStats = false;
      let pendingThinking = '';
      let pendingContent = '';
      let flushTimer: number | null = null;

      const flushPendingDeltas = () => {
        if (flushTimer !== null) {
          window.clearTimeout(flushTimer);
          flushTimer = null;
        }
        const thinkChunk = pendingThinking;
        const contentChunk = pendingContent;
        const hasStats = dirtyStats;
        if (!thinkChunk && !contentChunk && !hasStats) return;
        pendingThinking = '';
        pendingContent = '';
        dirtyStats = false;

        if (hasStats) {
          setLiveTokPerSec(latestTokPerSec);
        }

        if (thinkChunk || contentChunk) {
          updateActiveConversation((conv) => ({
            ...conv,
            messages: conv.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    thinking: thinkChunk ? (m.thinking ?? '') + thinkChunk : m.thinking,
                    content: contentChunk ? m.content + contentChunk : m.content,
                  }
                : m
            ),
          }));
        }
      };

      const scheduleFlush = () => {
        if (flushTimer !== null) return;
        flushTimer = window.setTimeout(flushPendingDeltas, 65);
      };

      controller.signal.addEventListener('abort', flushPendingDeltas, { once: true });

      setLiveTokPerSec(undefined);

      await openAIAdapter.sendChat({
        profile: activeProfile,
        history: historyForSend,
        settings: activeConv.settings,
        searchEngine: {
          providerId: searchConfig.activeProviderId,
          hasKey: hasActiveSearchKey,
          maxResults: searchConfig.maxResults,
        },
        signal: controller.signal,
        handlers: {
          onPhase(nextPhase) {
            if (nextPhase !== 'thinking') {
              flushPendingDeltas();
            }
            setPhase(nextPhase);
          },
          onStreamStats(stats) {
            if (stats.tokPerSec !== undefined) {
              latestTokPerSec = stats.tokPerSec;
              dirtyStats = true;
              scheduleFlush();
            }
          },
          onThinkingDelta(delta) {
            pendingThinking += delta;
            scheduleFlush();
          },
          onContentDelta(delta) {
            pendingContent += delta;
            scheduleFlush();
          },
          onComplete(result) {
            flushPendingDeltas();
            setLiveTokPerSec(undefined);
            setHappyBurst(true);
            window.setTimeout(() => setHappyBurst(false), 1200);
            updateActiveConversation((conv) => ({
              ...conv,
              updatedAt: Date.now(),
              messages: conv.messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: result.content,
                      thinking: result.thinking || m.thinking,
                      thinkingDurationMs: result.thinkingDurationMs,
                      metrics: result.metrics,
                    }
                  : m
              ),
            }));
          },
          onError(error) {
            flushPendingDeltas();
            setLiveTokPerSec(undefined);
            if (error instanceof KeyVaultError) {
              refreshVault();
              if (error.code === 'KEY_NOT_FOUND') {
                setVaultOpen(true);
              }
            }
            updateActiveConversation((conv) => ({
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === assistantId ? { ...m, error: error.message } : m
              ),
            }));
          },
        },
      });
    },
    [
      activeConv.settings,
      activeProfile,
      hasActiveSearchKey,
      refreshVault,
      searchConfig.activeProviderId,
      searchConfig.maxResults,
      updateActiveConversation,
    ]
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const content = (overrideText ?? prompt).trim();
      if (!content && attachments.length === 0) return;

      if (activeProfile.requiresApiKey && !hasActiveKey) {
        triggerHaptic('medium');
        setVaultOpen(true);
        pushToast(`Add an API key for ${activeProfile.name} first.`);
        return;
      }

      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `msg-u-${now.toString(36)}`,
        role: 'user',
        content,
        attachments: attachments.length > 0 ? [...attachments] : undefined,
        createdAt: now,
      };
      const assistantId = `msg-a-${(now + 1).toString(36)}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: '',
        createdAt: now + 1,
      };

      const historyForSend = [...activeConv.messages, userMsg];
      const shouldRename =
        activeConv.messages.length === 0 && activeConv.title === 'Playground';
      const nextTitle = shouldRename
        ? content.slice(0, 72) + (content.length > 72 ? '…' : '')
        : activeConv.title;

      updateActiveConversation((conv) => ({
        ...conv,
        title: nextTitle || conv.title,
        messages: [...conv.messages, userMsg, assistantPlaceholder],
        updatedAt: Date.now(),
      }));

      if (!overrideText) {
        setPrompt('');
        setAttachments([]);
      }

      await dispatchChat(historyForSend, assistantId);
    },
    [
      activeConv.messages,
      activeConv.title,
      activeProfile.name,
      activeProfile.requiresApiKey,
      attachments,
      dispatchChat,
      hasActiveKey,
      prompt,
      pushToast,
      updateActiveConversation,
    ]
  );

  const handleRetryMessage = useCallback(
    async (assistantMsgId: string) => {
      const idx = activeConv.messages.findIndex((m) => m.id === assistantMsgId);
      if (idx <= 0) return;
      const historyBefore = activeConv.messages.slice(0, idx);

      updateActiveConversation((conv) => ({
        ...conv,
        messages: conv.messages
          .slice(0, idx)
          .concat({
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            thinking: '',
            createdAt: Date.now(),
          }),
      }));

      await dispatchChat(historyBefore, assistantMsgId);
    },
    [activeConv.messages, dispatchChat, updateActiveConversation]
  );

  const handleEditMessage = useCallback(
    (msgId: string, nextContent: string) => {
      updateActiveConversation((conv) => ({
        ...conv,
        messages: conv.messages.map((m) =>
          m.id === msgId ? { ...m, content: nextContent } : m
        ),
        updatedAt: Date.now(),
      }));
      pushToast('Updated message');
    },
    [pushToast, updateActiveConversation]
  );

  const handleDeleteMessage = useCallback(
    (msgId: string) => {
      const convId = activeConv.id;
      const prevMessages = activeConv.messages;
      if (!prevMessages.some((m) => m.id === msgId)) return;

      abortRef.current?.abort();
      setPhase('idle');
      setLiveTokPerSec(undefined);

      updateActiveConversation((conv) => ({
        ...conv,
        messages: conv.messages.filter((m) => m.id !== msgId),
        updatedAt: Date.now(),
      }));

      pushToast('Deleted message', 'info', {
        label: 'Undo',
        run: () => {
          setConversations((cur) =>
            cur.map((c) =>
              c.id === convId
                ? { ...c, messages: prevMessages, updatedAt: Date.now() }
                : c
            )
          );
        },
      });
    },
    [activeConv.id, activeConv.messages, pushToast, updateActiveConversation]
  );

  const handleDeleteThinking = useCallback(
    (assistantMsgId: string) => {
      const convId = activeConv.id;
      const target = activeConv.messages.find((m) => m.id === assistantMsgId);
      if (!target) return;
      if (!target.content.trim() && !target.error) {
        handleDeleteMessage(assistantMsgId);
        return;
      }
      const prevThinking = target.thinking;
      const prevDuration = target.thinkingDurationMs;

      updateActiveConversation((conv) => ({
        ...conv,
        messages: conv.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, thinking: '', thinkingDurationMs: undefined }
            : m
        ),
        updatedAt: Date.now(),
      }));

      pushToast('Deleted reasoning trace', 'info', {
        label: 'Undo',
        run: () => {
          setConversations((cur) =>
            cur.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            thinking: prevThinking,
                            thinkingDurationMs: prevDuration,
                          }
                        : m
                    ),
                    updatedAt: Date.now(),
                  }
                : c
            )
          );
        },
      });
    },
    [activeConv.id, activeConv.messages, handleDeleteMessage, pushToast, updateActiveConversation]
  );

  const handleBranchMessage = useCallback(
    (msgId: string) => {
      const idx = activeConv.messages.findIndex((m) => m.id === msgId);
      if (idx < 0) return;

      const stamp = Date.now();
      const sliceSource = activeConv.messages.slice(0, idx + 1);
      const clonedMessages: ChatMessage[] = sliceSource.map((m, i) => ({
        ...m,
        id: `${m.id}-br-${stamp.toString(36)}-${i}`,
        attachments: m.attachments ? [...m.attachments] : undefined,
      }));

      const baseTitle = activeConv.title.replace(/\s+\(Branch(?:\s+\d+)?\)$/, '');
      const branchedConv: Conversation = {
        id: `conv-${stamp.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${baseTitle} (Branch)`,
        messages: clonedMessages,
        settings: { ...activeConv.settings },
        createdAt: stamp,
        updatedAt: stamp,
      };

      abortRef.current?.abort();
      setPhase('idle');
      setLiveTokPerSec(undefined);
      setConversations((prev) => [branchedConv, ...prev]);
      setActiveConvId(branchedConv.id);
      pushToast('Branched conversation from output');
    },
    [activeConv.messages, activeConv.settings, activeConv.title, pushToast]
  );

  const handleSaveProfile = useCallback(
    (profile: ProviderProfile) => {
      const prevProfile = profiles.find((p) => p.id === profile.id);
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === profile.id);
        return exists
          ? prev.map((p) => (p.id === profile.id ? profile : p))
          : [...prev, profile];
      });
      if (
        activeConv.settings.profileId === profile.id &&
        (!activeConv.settings.model ||
          (prevProfile && prevProfile.defaultModel !== profile.defaultModel && profile.defaultModel))
      ) {
        handleUpdateSettings({ model: profile.defaultModel });
      }
    },
    [
      activeConv.settings.model,
      activeConv.settings.profileId,
      handleUpdateSettings,
      profiles,
    ]
  );

  const handleDeleteProfile = useCallback(
    (profileId: string) => {
      if (profiles.length <= 1) return;
      keyVault.deleteApiKey(profileId);
      refreshVault();
      const nextList = profiles.filter((p) => p.id !== profileId);
      setProfiles(nextList);
      if (activeConv.settings.profileId === profileId && nextList[0]) {
        handleUpdateSettings({
          profileId: nextList[0].id,
          model: nextList[0].defaultModel,
        });
      }
    },
    [activeConv.settings.profileId, handleUpdateSettings, profiles, refreshVault]
  );

  const handleSaveSearchKey = useCallback(
    async (providerId: SearchProviderId, rawKey: string) => {
      const meta = await searchKeyStore.saveKey(providerId, rawKey);
      await refreshSearchVault();
      refreshVault();
      const spec = getSearchProviderSpec(providerId);
      const storageLabel =
        meta.backend === 'android-keystore' ? 'Android Keystore' : 'local vault';
      pushToast(`Saved ${spec.name} key securely in ${storageLabel}`);
    },
    [pushToast, refreshSearchVault, refreshVault]
  );

  const handleDeleteSearchKey = useCallback(
    async (providerId: SearchProviderId) => {
      await searchKeyStore.deleteKey(providerId);
      await refreshSearchVault();
      refreshVault();
      const spec = getSearchProviderSpec(providerId);
      pushToast(`Removed ${spec.name} API key`);
    },
    [pushToast, refreshSearchVault, refreshVault]
  );

  const handleVerifySearchVault = useCallback(async () => {
    return await searchKeyStore.verifyVault();
  }, []);

  const totalTokens = useMemo(() => {
    let total = estimateTextTokens(activeConv.settings.systemInstructions);
    for (const msg of activeConv.messages) {
      total += getCachedMessageTokens(msg);
    }
    for (const att of attachments) {
      total += estimateAttachmentTokens(att);
    }
    return total;
  }, [activeConv.messages, activeConv.settings.systemInstructions, attachments]);

  const activeMood: MaybotMood =
    phase !== 'idle'
      ? phase
      : happyBurst
        ? 'happy'
        : isTyping
          ? 'listening'
          : 'idle';

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <SpaceBackdrop
          theme={theme}
          dimmed={
            activeConv.messages.length > 0 ||
            prompt.trim().length > 0 ||
            isTyping
          }
        />
        <TopBar
          title={activeConv.title}
          tokenCount={totalTokens}
          activeProfile={activeProfile}
          vaultStatus={vaultStatus}
          hasActiveKey={hasActiveKey}
          theme={theme}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAppSettings={() => openAppSettings('appearance')}
          onOpenWebSearch={() => setWebSearchOpen(true)}
          onOpenVault={() => setVaultOpen(true)}
          onOpenGetCode={() => setGetCodeOpen(true)}
          onNewChat={handleNewChat}
          onClearChat={() => {
            abortRef.current?.abort();
            setPhase('idle');
            updateActiveConversation((conv) => ({
              ...conv,
              title: 'Playground',
              messages: [],
              updatedAt: Date.now(),
            }));
          }}
          onCycleTheme={() => {
            const idx = THEME_CYCLE.indexOf(theme);
            setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
          }}
          onRenameChat={(nextTitle) => {
            updateActiveConversation((conv) => ({
              ...conv,
              title: nextTitle,
              updatedAt: Date.now(),
            }));
          }}
        />

        <MessageList
          messages={activeConv.messages}
          phase={phase}
          activeMood={activeMood}
          activeProfile={activeProfile}
          hasActiveKey={hasActiveKey}
          proseFont={proseFont}
          autoScroll={activeConv.settings.autoScroll ?? true}
          onStarterSelect={(starter) => handleSend(starter)}
          onOpenVault={() => setVaultOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onRetryMessage={handleRetryMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onDeleteThinking={handleDeleteThinking}
          onBranchMessage={handleBranchMessage}
          onFeedback={(msgId, vote) => {
            updateActiveConversation((conv) => ({
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === msgId
                  ? { ...m, feedback: m.feedback === vote ? null : vote }
                  : m
              ),
            }));
          }}
        />

        <ComposerDock
          prompt={prompt}
          attachments={attachments}
          phase={phase}
          settings={activeConv.settings}
          vaultStatus={vaultStatus}
          hasActiveKey={hasActiveKey}
          activeSearchProviderId={searchConfig.activeProviderId}
          hasActiveSearchKey={hasActiveSearchKey}
          liveTokPerSec={liveTokPerSec}
          onPromptChange={setPrompt}
          onAddAttachments={(items) =>
            setAttachments((prev) => [...prev, ...items])
          }
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((a) => a.id !== id))
          }
          onSend={() => handleSend()}
          onStop={() => {
            abortRef.current?.abort();
            setPhase('idle');
            setLiveTokPerSec(undefined);
          }}
          onChangeThinking={(thinkingEffort) =>
            handleUpdateSettings({ thinkingEffort })
          }
          onToggleWebSearch={() => {
            if (!hasActiveSearchKey) {
              openAppSettings('search');
              pushToast('Add a search engine API key in Settings first.');
              return;
            }
            const nextEnabled = !(activeConv.settings.webSearchEnabled ?? true);
            handleUpdateSettings({ webSearchEnabled: nextEnabled });
            const spec = getSearchProviderSpec(searchConfig.activeProviderId);
            pushToast(
              nextEnabled
                ? `Web search (${spec.name}) enabled`
                : 'Web search disabled for this chat'
            );
          }}
          onOpenModelPicker={() => setModelPickerOpen(true)}
          onOpenVault={() => setVaultOpen(true)}
          onUserTypingChange={setIsTyping}
        />

        <HistoryVaultDrawer
          open={historyOpen}
          conversations={conversations}
          activeConversationId={activeConv.id}
          vaultStatus={vaultStatus}
          onClose={() => setHistoryOpen(false)}
          onSelectConversation={(id) => {
            abortRef.current?.abort();
            setPhase('idle');
            setActiveConvId(id);
          }}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onOpenVault={() => setVaultOpen(true)}
          onOpenAppSettings={() => openAppSettings('appearance')}
        />

        <RunSettingsDrawer
          open={settingsOpen}
          settings={activeConv.settings}
          activeProfile={activeProfile}
          savedPromptsCount={savedPrompts.length}
          activeSearchProviderId={searchConfig.activeProviderId}
          hasActiveSearchKey={hasActiveSearchKey}
          onClose={() => setSettingsOpen(false)}
          onUpdateSettings={handleUpdateSettings}
          onResetDefaults={() =>
            updateActiveConversation((conv) => ({
              ...conv,
              settings: createDefaultSettings(activeProfile),
            }))
          }
          onOpenModelPicker={() => setModelPickerOpen(true)}
          onOpenVault={() => setVaultOpen(true)}
          onOpenSearchSettings={() => openAppSettings('search')}
          onOpenGetCode={() => setGetCodeOpen(true)}
          onOpenSavedPrompts={() => setSavedPromptsOpen(true)}
        />

        <SavedPromptsModal
          open={savedPromptsOpen}
          savedPrompts={savedPrompts}
          currentInstructions={activeConv.settings.systemInstructions}
          onClose={() => setSavedPromptsOpen(false)}
          onSavePrompt={handleSaveSystemPrompt}
          onApplyPrompt={(content) =>
            handleUpdateSettings({ systemInstructions: content })
          }
          onDeletePrompt={handleDeleteSystemPrompt}
        />

        <SettingsModal
          open={appSettingsOpen}
          initialSection={appSettingsSection}
          theme={theme}
          proseFont={proseFont}
          syncInfo={syncInfo}
          providerCount={profiles.length}
          conversationCount={conversations.length}
          savedKeyCount={vaultStatus.keyCount}
          searchConfig={searchConfig}
          searchKeyMetadata={searchKeyMetadata}
          searchVaultInfo={searchVaultInfo}
          onClose={() => setAppSettingsOpen(false)}
          onThemeChange={setTheme}
          onProseFontChange={setProseFont}
          onSyncAction={handleSyncRemote}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onSearchConfigChange={setSearchConfig}
          onSaveSearchKey={handleSaveSearchKey}
          onDeleteSearchKey={handleDeleteSearchKey}
          onVerifySearchVault={handleVerifySearchVault}
          onOpenSearchSheet={() => setWebSearchOpen(true)}
          onNotify={pushToast}
        />

        <ProviderVaultSheet
          open={vaultOpen}
          profiles={profiles}
          activeProfileId={activeProfile.id}
          vaultStatus={vaultStatus}
          envelopesMeta={envelopesMeta}
          onClose={() => setVaultOpen(false)}
          onSelectProfile={(profileId, profileObj) => {
            const picked =
              profileObj ?? profiles.find((p) => p.id === profileId);
            if (picked) {
              handleUpdateSettings({
                profileId: picked.id,
                model: picked.defaultModel,
              });
            }
          }}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
          onRefreshVault={refreshVault}
          onNotify={pushToast}
        />

        <ModelPickerSheet
          open={modelPickerOpen}
          profiles={profiles}
          settings={activeConv.settings}
          onClose={() => setModelPickerOpen(false)}
          onSelectProfileAndModel={(profileId, model) =>
            handleUpdateSettings({ profileId, model })
          }
          onSaveProfile={handleSaveProfile}
          onChangeThinking={(thinkingEffort) =>
            handleUpdateSettings({ thinkingEffort })
          }
          onOpenVault={() => setVaultOpen(true)}
          onNotify={pushToast}
        />

        <WebSearchSheet
          open={webSearchOpen}
          config={searchConfig}
          keyMetadata={searchKeyMetadata}
          onClose={() => setWebSearchOpen(false)}
          onConfigChange={setSearchConfig}
          onOpenSearchSettings={() => openAppSettings('search')}
          onAttachResults={(attachment, queryText) => {
            setAttachments((prev) => [...prev, attachment]);
            if (!prompt.trim()) {
              setPrompt(`Summarize & analyze these results for: ${queryText}`);
            }
            pushToast('Search results attached to prompt');
          }}
          onAskAiWithResults={(promptText) => {
            void handleSend(promptText);
          }}
        />

        <GetCodeSheet
          open={getCodeOpen}
          profile={activeProfile}
          settings={activeConv.settings}
          history={activeConv.messages}
          onClose={() => setGetCodeOpen(false)}
        />

        <AnimatePresence>
          {vaultStatus.pinEnabled && !vaultStatus.unlocked && (
            <PinUnlockOverlay onUnlocked={refreshVault} />
          )}
        </AnimatePresence>

        {/* Floating Toasts (swipe left/right/up or scroll to dismiss) */}
        <div className="toast-stack" aria-live="polite">
          <AnimatePresence>
            {toasts.map((toast) => (
              <SwipeableToast
                key={toast.id}
                toast={toast}
                onDismiss={(id) =>
                  setToasts((prev) => prev.filter((t) => t.id !== id))
                }
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
