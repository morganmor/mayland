import type { ChatMessage } from '../types/mayland';

export function estimateTextTokens(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return Math.max(1, Math.ceil(cleaned.length / 3.8));
}

export function estimateMessagesTokens(
  messages: ChatMessage[],
  systemInstructions = ''
): number {
  let total = estimateTextTokens(systemInstructions);
  for (const msg of messages) {
    total += 4; // message framing overhead
    total += estimateTextTokens(msg.content);
    if (msg.thinking) {
      total += estimateTextTokens(msg.thinking);
    }
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.kind === 'image') total += 256;
        else if (att.textContent) total += estimateTextTokens(att.textContent);
      }
    }
  }
  return total;
}

export function formatTokenCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(count)));
}

export function formatTimeShort(ts: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}
