import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Unlock } from 'lucide-react';
import { keyVault } from '../crypto/keyVault';
import { useI18n } from '../i18n';
import { triggerHaptic } from '../utils/nativeBridge';
import { Maybot } from './Maybot';

interface PinUnlockOverlayProps {
  onUnlocked: () => void;
}

export const PinUnlockOverlay: React.FC<PinUnlockOverlayProps> = ({
  onUnlocked,
}) => {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setUnlocking(true);
    setError(null);
    try {
      await keyVault.unlockWithPin(pin);
      setPin('');
      triggerHaptic('medium');
      onUnlocked();
    } catch (err) {
      triggerHaptic('medium');
      setError((err as Error).message);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        backgroundColor: 'var(--color-paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 340,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <Maybot mood={error ? 'error' : unlocking ? 'decrypting' : 'idle'} size="lg" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-reading)',
              fontSize: '1.55rem',
              fontWeight: 600,
            }}
          >
            {t.pinOverlay.title}
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-muted)' }}>
            {t.pinOverlay.subtitle}
          </p>
        </div>

        <div style={{ width: '100%', position: 'relative' }}>
          <Lock
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-muted)',
            }}
          />
          <input
            id="pin-unlock-input"
            name="masterPin"
            type="password"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t.pinOverlay.pinPlaceholder}
            className="drawer-field"
            style={{
              backgroundColor: 'var(--color-paper-2)',
              paddingLeft: 40,
              minHeight: 48,
            }}
          />
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <motion.button
          type="submit"
          className="accent-pill-btn"
          style={{ width: '100%', minHeight: 46 }}
          disabled={unlocking || !pin.trim()}
          whileTap={{ scale: 0.96 }}
        >
          <Unlock size={16} />
          <span>{unlocking ? t.pinOverlay.decrypting : t.pinOverlay.unlock}</span>
        </motion.button>
      </form>
    </motion.div>
  );
};
