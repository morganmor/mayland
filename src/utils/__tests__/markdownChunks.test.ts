import { describe, expect, it } from 'vitest';
import { splitMarkdownBlocks } from '../markdownChunks';

describe('splitMarkdownBlocks', () => {
  it('returns empty array for empty or whitespace strings', () => {
    expect(splitMarkdownBlocks('')).toEqual([]);
    expect(splitMarkdownBlocks('   \n\n  ')).toEqual([]);
  });

  it('groups paragraphs deterministically while freezing earlier chunks as content grows', () => {
    const p1 = 'Paragraph one.';
    const p2 = 'Paragraph two.';
    const p3 = 'Paragraph three.';
    const p4 = 'Paragraph four.';

    const step1 = splitMarkdownBlocks(`${p1}\n\n${p2}\n\n${p3}`, 2);
    const step2 = splitMarkdownBlocks(`${p1}\n\n${p2}\n\n${p3}\n\n${p4}`, 2);

    expect(step1).toEqual([`${p1}\n\n${p2}`, p3]);
    expect(step2[0]).toBe(step1[0]);
    expect(step2).toEqual([`${p1}\n\n${p2}`, `${p3}\n\n${p4}`]);
  });

  it('never splits inside fenced code blocks even with blank lines or hash comments', () => {
    const md = [
      'Intro text',
      '',
      '```ts',
      'const a = 1;',
      '',
      '# not a markdown heading',
      '',
      'const b = 2;',
      '```',
      '',
      'Outro A',
      '',
      'Outro B',
    ].join('\n');

    const chunks = splitMarkdownBlocks(md, 2);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('```ts');
    expect(chunks[0]).toContain('const b = 2;\n```');
    expect(chunks[1]).toBe('Outro A\n\nOutro B');
  });

  it('keeps loose ordered list items in the same block so numbering does not reset', () => {
    const md = ['1. First item', '', '2. Second item', '', '3. Third item', '', 'After'].join(
      '\n'
    );
    const chunks = splitMarkdownBlocks(md, 1);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('1. First item');
    expect(chunks[0]).toContain('3. Third item');
    expect(chunks[1]).toBe('After');
  });
});
