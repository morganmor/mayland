/**
 * Splits Markdown into stable, fence-aware chunks so long streaming outputs
 * only re-parse the active tail chunk instead of the entire document.
 */

const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const INDENT_CONT_RE = /^(?: {2,}|\t)\S/;
const HEADING_RE = /^#{1,6}(?:\s|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function splitMarkdownBlocks(markdown: string, groupSize = 2): string[] {
  if (!markdown) return [];
  const normalized = markdown.replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return [];

  const lines = normalized.split('\n');
  const blocks: string[] = [];

  let current: string[] = [];
  let pendingBlanks = 0;
  let fenceChar: '`' | '~' | null = null;
  let fenceLen = 0;
  let inList = false;

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
    pendingBlanks = 0;
    inList = false;
  };

  for (const line of lines) {
    if (fenceChar !== null) {
      current.push(line);
      const trimmed = line.trim();
      if (
        trimmed.startsWith(fenceChar.repeat(fenceLen)) &&
        trimmed.slice(fenceLen).replace(new RegExp(`^${fenceChar}+`), '').trim() === ''
      ) {
        fenceChar = null;
        fenceLen = 0;
      }
      continue;
    }

    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      if (pendingBlanks > 0 && current.length > 0) {
        flush();
      } else if (pendingBlanks > 0) {
        pendingBlanks = 0;
      }
      const marker = fenceMatch[1];
      fenceChar = marker[0] as '`' | '~';
      fenceLen = marker.length;
      current.push(line);
      inList = false;
      continue;
    }

    if (line.trim() === '') {
      if (current.length > 0) {
        pendingBlanks += 1;
      }
      continue;
    }

    const isHeading = HEADING_RE.test(line);
    const isList = LIST_ITEM_RE.test(line);
    const isIndented = INDENT_CONT_RE.test(line);

    if (pendingBlanks > 0 && current.length > 0) {
      const continueLooseList = inList && (isList || isIndented) && !isHeading;
      if (continueLooseList) {
        for (let i = 0; i < pendingBlanks; i += 1) {
          current.push('');
        }
        pendingBlanks = 0;
        current.push(line);
        continue;
      }
      flush();
    } else if (isHeading && current.length > 0) {
      flush();
    }

    pendingBlanks = 0;
    if (current.length === 0) {
      inList = isList;
    } else if (isList) {
      inList = true;
    }
    current.push(line);
  }

  flush();

  const safeGroup = Math.max(1, Math.floor(groupSize));
  if (safeGroup === 1) return blocks;

  const chunks: string[] = [];
  for (let i = 0; i < blocks.length; i += safeGroup) {
    chunks.push(blocks.slice(i, i + safeGroup).join('\n\n'));
  }
  return chunks;
}
