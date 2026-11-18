import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types/mayland';
import { buildFishEyeSlots, buildTurnCheckpoints } from './TurnTimelineRail';

const makeMsg = (id: string, role: 'user' | 'assistant', content: string): ChatMessage => ({
  id,
  role,
  content,
  createdAt: 1000,
});

describe('buildTurnCheckpoints', () => {
  it('counts 1 user input + 1 model output as 1 checkpoint', () => {
    const cps = buildTurnCheckpoints([
      makeMsg('u1', 'user', 'Halo'),
      makeMsg('a1', 'assistant', 'Halo! Ada yang bisa saya bantu?'),
    ]);

    expect(cps).toHaveLength(1);
    expect(cps[0].id).toBe('u1');
    expect(cps[0].assistantId).toBe('a1');
    expect(cps[0].turnNumber).toBe(1);
  });

  it('pairs consecutive turns and handles a pending trailing user prompt', () => {
    const cps = buildTurnCheckpoints([
      makeMsg('u1', 'user', 'First'),
      makeMsg('a1', 'assistant', 'Reply 1'),
      makeMsg('u2', 'user', 'Second'),
      makeMsg('a2', 'assistant', 'Reply 2'),
      makeMsg('u3', 'user', 'Pending third'),
    ]);

    expect(cps.map((c) => [c.turnNumber, c.id, c.assistantId ?? null])).toEqual([
      [1, 'u1', 'a1'],
      [2, 'u2', 'a2'],
      [3, 'u3', null],
    ]);
  });

  it('keeps an orphaned assistant message as its own checkpoint', () => {
    const cps = buildTurnCheckpoints([makeMsg('a1', 'assistant', 'Lonely output')]);
    expect(cps).toHaveLength(1);
    expect(cps[0].id).toBe('a1');
    expect(cps[0].assistantMsg?.content).toBe('Lonely output');
  });
});

describe('buildFishEyeSlots', () => {
  it('keeps all checkpoints directly when conversation fits within maxSlots', () => {
    const slots = buildFishEyeSlots(12, 5, 21);
    expect(slots).toHaveLength(12);
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('bounds DOM slots to maxSlots while keeping first, last, and dense local focus window for 150 turns', () => {
    const slots = buildFishEyeSlots(150, 72, 21);
    const indices = slots.map((s) => s.index);

    expect(slots.length).toBeLessThanOrEqual(21);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(149);
    // All local neighbors 68..76 around focus 72 must be preserved 1:1
    for (let i = 68; i <= 76; i += 1) {
      expect(indices).toContain(i);
    }
    // Strictly ascending unique indices
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});
