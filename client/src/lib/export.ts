import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toCanvas, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { DesignDoc } from '../types';
import { StaticPage } from '../editor/ElementView';

export type ExportFormat = 'png' | 'jpg' | 'pdf' | 'svg';

async function waitForImages(root: HTMLElement) {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );
  await document.fonts.ready;
}

// Render one page off-screen at natural size and hand the DOM node to `fn`.
async function withRenderedPage<T>(doc: DesignDoc, index: number, fn: (node: HTMLElement) => Promise<T>): Promise<T> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(StaticPage, { page: doc.pages[index], width: doc.width, height: doc.height })));
    const node = host.firstElementChild as HTMLElement;
    await waitForImages(node);
    return await fn(node);
  } finally {
    root.unmount();
    host.remove();
  }
}

const fontEmbed = { skipFonts: false, cacheBust: false, preferredFontFormat: 'woff2' as const };

export async function renderPageCanvas(doc: DesignDoc, index: number, scale: number, background?: string) {
  return withRenderedPage(doc, index, (node) =>
    toCanvas(node, { width: doc.width, height: doc.height, pixelRatio: scale, backgroundColor: background, ...fontEmbed }),
  );
}

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'design';

export async function exportDesign(
  doc: DesignDoc,
  title: string,
  format: ExportFormat,
  pages: number[],
  scale = 1,
  transparent = false,
  onProgress?: (done: number, total: number) => void,
) {
  const name = safe(title);
  if (format === 'pdf') {
    const pdf = new jsPDF({
      orientation: doc.width >= doc.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [doc.width, doc.height],
      hotfixes: ['px_scaling'],
      compress: true,
    });
    for (const [i, p] of pages.entries()) {
      const canvas = await renderPageCanvas(doc, p, Math.max(scale, 2), '#ffffff');
      if (i > 0) pdf.addPage([doc.width, doc.height], doc.width >= doc.height ? 'landscape' : 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, doc.width, doc.height);
      onProgress?.(i + 1, pages.length);
    }
    pdf.save(`${name}.pdf`);
    return;
  }
  for (const [i, p] of pages.entries()) {
    const suffix = pages.length > 1 ? `-${p + 1}` : '';
    if (format === 'svg') {
      const url = await withRenderedPage(doc, p, (node) => toSvg(node, { width: doc.width, height: doc.height, ...fontEmbed }));
      download(url, `${name}${suffix}.svg`);
    } else {
      const src =
        transparent && format === 'png'
          ? { ...doc, pages: doc.pages.map((pg) => ({ ...pg, background: { type: 'solid' as const, color: 'transparent' }, backgroundImage: undefined })) }
          : doc;
      const canvas = await renderPageCanvas(src, p, scale);
      const url = format === 'jpg' ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png');
      download(url, `${name}${suffix}.${format}`);
    }
    onProgress?.(i + 1, pages.length);
  }
}

export async function makeThumbnail(doc: DesignDoc): Promise<string | null> {
  try {
    const scale = Math.min(1, 480 / doc.width);
    const canvas = await renderPageCanvas(doc, 0, scale);
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}
