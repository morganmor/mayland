import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { ChatMessage } from '../types/mayland';
import { triggerHaptic } from '../utils/nativeBridge';

export interface TurnCheckpoint {
  id: string;
  assistantId?: string;
  turnNumber: number;
  userMsg?: ChatMessage;
  assistantMsg?: ChatMessage;
}

export interface FishEyeSlot {
  index: number;
  compressed: boolean;
}

const MAX_RAIL_SLOTS = 21;
const LENS_RADIUS = 4;

export function buildTurnCheckpoints(messages: ChatMessage[]): TurnCheckpoint[] {
  const checkpoints: TurnCheckpoint[] = [];
  let turnNumber = 1;

  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i];
    if (current.role === 'user') {
      const next = messages[i + 1];
      if (next && next.role === 'assistant') {
        checkpoints.push({
          id: current.id,
          assistantId: next.id,
          turnNumber,
          userMsg: current,
          assistantMsg: next,
        });
        i += 1;
      } else {
        checkpoints.push({
          id: current.id,
          turnNumber,
          userMsg: current,
        });
      }
      turnNumber += 1;
      continue;
    }

    checkpoints.push({
      id: current.id,
      assistantId: current.id,
      turnNumber,
      assistantMsg: current,
    });
    turnNumber += 1;
  }

  return checkpoints;
}

/**
 * Produces at most `maxSlots` ordered checkpoint indices out of `0..total-1`:
 * pins first & last landmarks, preserves 1:1 precision around `focusIndex`,
 * and samples overview milestones across large (dozens/100+) turn conversations.
 */
export function buildFishEyeSlots(
  total: number,
  focusIndex: number,
  maxSlots = MAX_RAIL_SLOTS
): FishEyeSlot[] {
  if (total <= 0) return [];
  const cap = Math.max(5, Math.floor(maxSlots));

  if (total <= cap) {
    return Array.from({ length: total }, (_, index) => ({
      index,
      compressed: false,
    }));
  }

  const center = Math.min(total - 1, Math.max(0, Math.round(focusIndex)));
  const selected = new Set<number>([0, total - 1]);

  const localStart = Math.max(0, center - LENS_RADIUS);
  const localEnd = Math.min(total - 1, center + LENS_RADIUS);
  for (let i = localStart; i <= localEnd; i += 1) {
    selected.add(i);
  }

  const remainingBudget = Math.max(0, cap - selected.size);
  const leftSpan = Math.max(0, localStart - 1);
  const rightSpan = Math.max(0, total - 2 - localEnd);
  const totalOuter = leftSpan + rightSpan;

  if (remainingBudget > 0 && totalOuter > 0) {
    let leftQuota =
      leftSpan > 0 ? Math.round((remainingBudget * leftSpan) / totalOuter) : 0;
    if (leftSpan > 0 && leftQuota === 0 && remainingBudget > (rightSpan > 0 ? 1 : 0)) {
      leftQuota = 1;
    }
    const rightQuota = Math.min(rightSpan, remainingBudget - leftQuota);

    if (leftQuota > 0 && leftSpan > 0) {
      for (let k = 1; k <= leftQuota; k += 1) {
        const idx = Math.round((k * (localStart - 1)) / (leftQuota + 1));
        if (idx > 0 && idx < localStart) selected.add(idx);
      }
    }
    if (rightQuota > 0 && rightSpan > 0) {
      for (let k = 1; k <= rightQuota; k += 1) {
        const idx =
          localEnd + Math.round((k * (total - 1 - localEnd)) / (rightQuota + 1));
        if (idx > localEnd && idx < total - 1) selected.add(idx);
      }
    }
  }

  const sorted = Array.from(selected).sort((a, b) => a - b);
  return sorted.map((index, pos) => {
    const prevGap = pos > 0 ? index - sorted[pos - 1] > 1 : false;
    const nextGap = pos < sorted.length - 1 ? sorted[pos + 1] - index > 1 : false;
    return {
      index,
      compressed: (prevGap || nextGap) && Math.abs(index - center) > LENS_RADIUS,
    };
  });
}

function summarizeCheckpoint(cp: TurnCheckpoint): string {
  const userPreview = cp.userMsg?.content.replace(/\s+/g, ' ').trim() ?? '';
  const assistantPreview = cp.assistantMsg?.content.replace(/\s+/g, ' ').trim() ?? '';
  if (userPreview && assistantPreview) {
    return `${userPreview.slice(0, 26)}${userPreview.length > 26 ? '…' : ''} → ${assistantPreview.slice(0, 24)}${assistantPreview.length > 24 ? '…' : ''}`;
  }
  const single = userPreview || assistantPreview || 'Exchange';
  return single.length > 48 ? `${single.slice(0, 47)}…` : single;
}

interface TurnTimelineRailProps {
  messages: ChatMessage[];
  activeId: string | null;
  onJumpToMessage: (id: string) => void;
}

export const TurnTimelineRail: React.FC<TurnTimelineRailProps> = ({
  messages,
  activeId,
  onJumpToMessage,
}) => {
  const { t } = useI18n();
  const railRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number | null;
    startY: number;
    moved: boolean;
    lastTickIdx: number;
  }>({
    pointerId: null,
    startY: 0,
    moved: false,
    lastTickIdx: -1,
  });

  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [scrubPos, setScrubPos] = useState<number | null>(null);

  const checkpoints = useMemo(() => buildTurnCheckpoints(messages), [messages]);
  const total = checkpoints.length;

  useEffect(() => {
    setHoverPos(null);
    setScrubPos(null);
  }, [total]);

  const activeIdx = useMemo(() => {
    if (total === 0) return 0;
    if (!activeId) return total - 1;
    const found = checkpoints.findIndex(
      (cp) => cp.id === activeId || (cp.assistantId !== undefined && cp.assistantId === activeId)
    );
    return found >= 0 ? found : total - 1;
  }, [activeId, checkpoints, total]);

  const pointerPos = scrubPos ?? hoverPos;
  const isInteracting = pointerPos !== null;
  const focusPos = pointerPos ?? activeIdx;
  const focusIdx = Math.min(total - 1, Math.max(0, Math.round(focusPos)));

  const slots = useMemo(
    () => buildFishEyeSlots(total, focusIdx, MAX_RAIL_SLOTS),
    [focusIdx, total]
  );

  const focalSlotPos = useMemo(() => {
    if (slots.length === 0) return 0;
    let bestPos = 0;
    let bestDist = Infinity;
    for (let i = 0; i < slots.length; i += 1) {
      const dist = Math.abs(slots[i].index - focusPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = i;
      }
    }
    return bestPos;
  }, [focusPos, slots]);

  const clientYToCheckpointPos = useCallback(
    (clientY: number): number => {
      if (total <= 1) return 0;
      const trackEl = trackRef.current ?? railRef.current;
      if (!trackEl) return activeIdx;
      const rect = trackEl.getBoundingClientRect();
      const inset = 8;
      const usable = Math.max(1, rect.height - inset * 2);
      const ratio = Math.min(1, Math.max(0, (clientY - (rect.top + inset)) / usable));
      return ratio * (total - 1);
    },
    [activeIdx, total]
  );

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (total === 0) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rail = railRef.current;
      if (rail) {
        try {
          rail.setPointerCapture(e.pointerId);
        } catch {
          // ignore if capture is unsupported
        }
      }
      const nextPos = clientYToCheckpointPos(e.clientY);
      const nextIdx = Math.min(total - 1, Math.max(0, Math.round(nextPos)));
      dragStateRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        moved: false,
        lastTickIdx: nextIdx,
      };
      if (e.pointerType !== 'mouse') {
        setScrubPos(nextPos);
      }
    },
    [clientYToCheckpointPos, total]
  );

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (total === 0) return;
      const drag = dragStateRef.current;
      const nextPos = clientYToCheckpointPos(e.clientY);
      const nextIdx = Math.min(total - 1, Math.max(0, Math.round(nextPos)));

      if (drag.pointerId === e.pointerId) {
        if (!drag.moved && Math.abs(e.clientY - drag.startY) >= 4) {
          drag.moved = true;
        }
        if (drag.moved) {
          setScrubPos(nextPos);
          if (nextIdx !== drag.lastTickIdx) {
            drag.lastTickIdx = nextIdx;
            triggerHaptic('light');
            const target = checkpoints[nextIdx];
            if (target) {
              onJumpToMessage(target.id);
            }
          }
          return;
        }
      }

      if (e.pointerType === 'mouse') {
        setHoverPos(nextPos);
      }
    },
    [checkpoints, clientYToCheckpointPos, onJumpToMessage, total]
  );

  const finishScrub = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== e.pointerId) return;
      const wasMoved = drag.moved;
      drag.pointerId = null;
      drag.moved = false;

      const rail = railRef.current;
      if (rail) {
        try {
          rail.releasePointerCapture(e.pointerId);
        } catch {
          // ignore release error
        }
      }

      if (wasMoved && total > 0) {
        const finalPos = clientYToCheckpointPos(e.clientY);
        const finalIdx = Math.min(total - 1, Math.max(0, Math.round(finalPos)));
        const target = checkpoints[finalIdx];
        if (target) {
          triggerHaptic('light');
          onJumpToMessage(target.id);
        }
      }
      setScrubPos(null);
    },
    [checkpoints, clientYToCheckpointPos, onJumpToMessage, total]
  );

  if (total === 0) return null;

  const focusedCp = checkpoints[focusIdx];
  const hudSummary = focusedCp ? summarizeCheckpoint(focusedCp) : '';
  const hudTopPct =
    slots.length > 1
      ? Math.min(88, Math.max(12, (focalSlotPos / (slots.length - 1)) * 100))
      : 50;

  return (
    <nav
      ref={railRef}
      className="timeline-rail"
      data-interacting={isInteracting ? 'true' : 'false'}
      data-dense={total > 12 ? 'true' : 'false'}
      aria-label={t.timeline.navAria}
      onPointerDown={handleTrackPointerDown}
      onPointerMove={handleTrackPointerMove}
      onPointerUp={finishScrub}
      onPointerCancel={finishScrub}
      onPointerLeave={(e) => {
        if (dragStateRef.current.pointerId === null && e.pointerType === 'mouse') {
          setHoverPos(null);
        }
      }}
    >
      {total > MAX_RAIL_SLOTS && (
        <span className="timeline-edge-count tabular-nums" aria-hidden="true">
          1
        </span>
      )}

      <div ref={trackRef} className="timeline-slots">
        <span className="timeline-track-line" aria-hidden="true" />

        {slots.map((slot, slotIdx) => {
          const cp = checkpoints[slot.index];
          if (!cp) return null;

          const isActive = slot.index === activeIdx;
          const isFocused = isInteracting && slot.index === focusIdx;
          const slotDist = isInteracting
            ? Math.abs(slotIdx - focalSlotPos)
            : Math.abs(slot.index - activeIdx);

          const falloff = Math.exp(-(slotDist * slotDist) / 4.2);
          const scale = isInteracting
            ? 0.88 + falloff * 1.05
            : isActive
              ? 1.5
              : 0.92 + Math.exp(-(slotDist * slotDist) / 2.2) * 0.25;
          const shiftX = isInteracting ? -(falloff * 10) : 0;

          const tooltip = t.timeline.checkpointTooltip(
            cp.turnNumber,
            total,
            summarizeCheckpoint(cp)
          );

          return (
            <button
              key={cp.id}
              type="button"
              className="timeline-dot-btn"
              data-dense={total > 14 ? 'true' : 'false'}
              style={{
                transform: `translate3d(${shiftX.toFixed(1)}px, 0, 0)`,
              }}
              onClick={(e) => {
                if (dragStateRef.current.moved) {
                  e.preventDefault();
                  return;
                }
                triggerHaptic('light');
                onJumpToMessage(cp.id);
              }}
              aria-label={t.timeline.jumpToAria(cp.turnNumber)}
              title={tooltip}
            >
              <span
                className="timeline-dot"
                data-role={cp.assistantMsg ? 'pair' : 'user'}
                data-complete={cp.assistantMsg ? 'true' : 'false'}
                data-active={isActive ? 'true' : 'false'}
                data-focused={isFocused ? 'true' : 'false'}
                data-compressed={slot.compressed ? 'true' : 'false'}
                style={{
                  transform: `scale(${scale.toFixed(2)})`,
                }}
              />
            </button>
          );
        })}

        {isInteracting && focusedCp && (
          <div
            className="timeline-fisheye-hud"
            style={{ top: `${hudTopPct.toFixed(1)}%` }}
            aria-hidden="true"
          >
            <span className="timeline-fisheye-badge tabular-nums">
              #{focusedCp.turnNumber} / {total}
            </span>
            <span className="timeline-fisheye-preview">{hudSummary}</span>
          </div>
        )}
      </div>

      {total > 12 && (
        <span className="timeline-edge-count timeline-edge-count--active tabular-nums" aria-hidden="true">
          {isInteracting ? focusIdx + 1 : activeIdx + 1}/{total}
        </span>
      )}
    </nav>
  );
};
