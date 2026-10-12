// Background remover for photos shot on a fairly plain background: estimates the
// background colour from the image border, flood-fills it from the edges and feathers
// the cut. Runs locally on a canvas.

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not load this image'));
    img.src = src;
  });
}

export async function removeBackground(src: string, tolerance = 48): Promise<Blob> {
  const img = await load(src);
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;

  // Background colour: per-channel median of the border pixels.
  const border: number[][] = [[], [], []];
  const take = (i: number) => {
    for (let ch = 0; ch < 3; ch++) border[ch].push(px[i * 4 + ch]);
  };
  for (let x = 0; x < w; x++) {
    take(x);
    take((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    take(y * w);
    take(y * w + w - 1);
  }
  const bg = border.map((arr) => arr.sort((a, b) => a - b)[arr.length >> 1]);
  const dist = (i: number) => Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]);

  // Flood fill from every border pixel that looks like background.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!seen[i] && dist(i) < tolerance) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  let removed = 0;
  for (let i = 0; i < w * h; i++) {
    if (seen[i]) {
      px[i * 4 + 3] = 0;
      removed++;
      continue;
    }
    // Soften pixels right next to the cut-out.
    const x = i % w;
    const nearCut = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (i >= w && seen[i - w]) || (i < w * (h - 1) && seen[i + w]);
    if (nearCut) px[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.min(1, dist(i) / (tolerance * 2)));
  }
  if (removed < w * h * 0.02) throw new Error('No plain background found around the edges of this photo');
  g.putImageData(data, 0, 0);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}
