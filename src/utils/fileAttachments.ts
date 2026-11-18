import type { Attachment } from '../types/mayland';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif',
  'heic',
  'heif',
  'ico',
  'tif',
  'tiff',
]);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'mdx',
  'markdown',
  'json',
  'jsonl',
  'csv',
  'tsv',
  'xml',
  'svg',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'sh',
  'bash',
  'zsh',
  'bat',
  'cmd',
  'ps1',
  'sql',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'log',
  'env',
  'gradle',
  'properties',
  'gitignore',
  'dockerfile',
]);

const TEXT_MIME_EXACT = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/typescript',
  'application/x-yaml',
  'application/yaml',
  'application/toml',
  'application/sql',
  'application/x-sh',
  'image/svg+xml',
]);

const MAX_AUTO_TEXT_DETECT_BYTES = 2 * 1024 * 1024;

function getFileExtension(name: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === name.length - 1) return '';
  return name.slice(dotIdx + 1).toLowerCase();
}

function createAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function isImageUpload(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/svg+xml') return false;
  if (mime.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(getFileExtension(file.name));
}

function isKnownTextUpload(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('text/') || TEXT_MIME_EXACT.has(mime)) return true;
  return TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

async function looksLikeUtf8Text(file: File): Promise<boolean> {
  if (file.size === 0) return true;
  if (file.size > MAX_AUTO_TEXT_DETECT_BYTES) return false;
  const mime = (file.type || '').toLowerCase();
  if (
    mime &&
    !mime.startsWith('text/') &&
    !mime.includes('json') &&
    !mime.includes('xml') &&
    mime !== 'application/octet-stream'
  ) {
    return false;
  }

  try {
    const sample = await file.slice(0, 4096).arrayBuffer();
    const bytes = new Uint8Array(sample);
    let controlCount = 0;
    for (const byte of bytes) {
      if (byte === 0) return false;
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) {
        controlCount += 1;
      }
    }
    return controlCount / Math.max(1, bytes.length) < 0.05;
  } catch {
    return false;
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const mime = file.type || 'application/octet-stream';
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

async function fileToText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

/**
 * Normalizes picked browser/Android files into Mayland Attachment records.
 * Supports picking any file type (images, text/code, PDFs, binaries).
 */
export async function processUploadedFiles(
  files: FileList | File[] | null,
  mode: 'any' | 'image'
): Promise<Attachment[]> {
  if (!files || files.length === 0) return [];
  const list = Array.from(files);
  const out: Attachment[] = [];

  for (const file of list) {
    const treatAsImage = mode === 'image' || isImageUpload(file);
    if (treatAsImage) {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl) {
        out.push({
          id: createAttachmentId(),
          kind: 'image',
          name: file.name,
          mimeType: file.type || 'image/png',
          size: file.size,
          dataUrl,
        });
      }
      continue;
    }

    if (isKnownTextUpload(file) || (await looksLikeUtf8Text(file))) {
      const textContent = await fileToText(file);
      out.push({
        id: createAttachmentId(),
        kind: 'text',
        name: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        textContent,
      });
      continue;
    }

    const dataUrl = await readFileAsDataUrl(file);
    out.push({
      id: createAttachmentId(),
      kind: 'file',
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: dataUrl || undefined,
    });
  }

  return out;
}
