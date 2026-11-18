import { describe, expect, it } from 'vitest';
import { formatFileSize, processUploadedFiles } from './fileAttachments';

describe('fileAttachments', () => {
  it('formats file sizes clearly across B, KB, and MB ranges', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2560)).toBe('2.5 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('routes images, text files, and arbitrary PDF/binary files in "any" mode', async () => {
    const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', {
      type: 'image/png',
    });
    const codeFile = new File(['export const x = 42;\n'], 'sample.ts', {
      type: 'text/plain',
    });
    const pdfFile = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'report.pdf',
      { type: 'application/pdf' }
    );
    const unknownTextFile = new File(['HELLO=world\n'], 'Makefile', {
      type: '',
    });
    const archiveFile = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff])],
      'bundle.zip',
      { type: 'application/zip' }
    );

    const processed = await processUploadedFiles(
      [pngFile, codeFile, pdfFile, unknownTextFile, archiveFile],
      'any'
    );

    expect(processed).toHaveLength(5);
    expect(processed[0]).toMatchObject({
      kind: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
    });
    expect(processed[0].dataUrl).toMatch(/^data:image\/png;base64,/);

    expect(processed[1]).toMatchObject({
      kind: 'text',
      name: 'sample.ts',
      textContent: 'export const x = 42;\n',
    });

    expect(processed[2]).toMatchObject({
      kind: 'file',
      name: 'report.pdf',
      mimeType: 'application/pdf',
    });
    expect(processed[2].dataUrl).toMatch(/^data:application\/pdf;base64,/);

    expect(processed[3]).toMatchObject({
      kind: 'text',
      name: 'Makefile',
      textContent: 'HELLO=world\n',
    });

    expect(processed[4]).toMatchObject({
      kind: 'file',
      name: 'bundle.zip',
      mimeType: 'application/zip',
    });
  });

  it('forces image handling in "image" upload mode', async () => {
    const svgOrImg = new File(['fake-bytes'], 'camera-shot', {
      type: 'application/octet-stream',
    });
    const [att] = await processUploadedFiles([svgOrImg], 'image');
    expect(att.kind).toBe('image');
    expect(att.dataUrl).toMatch(/^data:/);
  });
});
