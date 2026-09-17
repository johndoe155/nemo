import html2canvas from 'html2canvas';

// A footer-sized texture, not another full-screen raymarch. These are memory /
// raster limits, not physics or art-direction knobs. CSS pixels stay unchanged.
const MAX_PIXELS = 1_500_000;
const MAX_EDGE = 2048;

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Sign-off capture cancelled', 'AbortError');
}

function asDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** SVG foreignObject images cannot fetch external fonts. Embed the site's
 * already-loaded faces, selected from its real @font-face rules (no second
 * list of font names/URLs that could drift from the design system). Otherwise
 * the Machina inktraps silently turn into a system font in the frozen frame. */
async function snapshotFonts(root: HTMLElement, signal: AbortSignal): Promise<string> {
  const families = new Set(
    [root, ...root.querySelectorAll<HTMLElement>('*')].map((el) =>
      getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    ),
  );
  const loaded = Array.from(document.fonts).filter((face) => face.status === 'loaded');
  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  const visit = (sheet: CSSStyleSheet) => {
    // All site fonts are same-origin. Unreadable third-party sheets must not
    // prevent capture of the local design system.
    let cssRules: CSSRuleList;
    try { cssRules = sheet.cssRules; } catch { return; }
    for (const rule of Array.from(cssRules)) {
      if (rule instanceof CSSImportRule && rule.styleSheet) visit(rule.styleSheet);
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.fontFamily.replace(/["']/g, '').trim();
      if (!families.has(family)) continue;
      if (!loaded.some((face) =>
        face.family.replace(/["']/g, '').trim() === family &&
        face.weight === (rule.style.fontWeight || 'normal') &&
        face.style === (rule.style.fontStyle || 'normal'),
      )) continue;
      rules.push({ rule, base: sheet.href ?? document.baseURI });
    }
  };
  Array.from(document.styleSheets).forEach(visit);

  const embedded = await Promise.all(rules.map(async ({ rule, base }) => {
    const source = rule.style.getPropertyValue('src');
    const url = /url\(["']?([^"')]+)["']?\)/.exec(source)?.[1];
    if (!url) return '';
    const response = await fetch(new URL(url, base), { signal });
    if (!response.ok) throw new Error(`Snapshot font request failed (${response.status})`);
    const data = await asDataURL(await response.blob());
    checkAbort(signal);
    return `@font-face { ${rule.style.cssText.replace(source, `url("${data}")`)} }`;
  }));
  return embedded.join('\n');
}

/** One frozen DOM raster. Nothing here writes to the live sign-off.
 *
 * html2canvas's ordinary painter does NOT support background-clip:text (the
 * main headline), masks or this rotated glass band accurately. Its native
 * foreignObject path preserves those CSS features. Fonts must be embedded;
 * backdrop-filter cannot sample the live page from an isolated SVG, so ONLY
 * that decorative blur is omitted in the clone. The glass tint, mask, crawl,
 * chroma ink, button strata and current cursor spark are retained.
 *
 * The root's background stays in real DOM to preserve the existing curtain
 * hem. Capture its CONTENT on alpha, avoiding a doubled background gradient.
 */
export async function captureSignoff(
  root: HTMLElement,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  checkAbort(signal);
  const fonts = await snapshotFonts(root, signal);
  checkAbort(signal);

  const { width, height } = root.getBoundingClientRect();
  if (!width || !height) throw new Error('Cannot snapshot a zero-sized sign-off');
  const scale = Math.min(
    window.devicePixelRatio || 1,
    Math.sqrt(MAX_PIXELS / (width * height)),
    MAX_EDGE / width,
    MAX_EDGE / height,
  );
  let cloneFrame: Element | null = null;
  let canvas: HTMLCanvasElement | null = null;
  // html2canvas has no abort API and does not remove its iframe on rejection.
  // Track ONLY this invocation's frame and free it in finally, including a
  // late result after StrictMode cleanup; never touch another capture's frame.
  const framesBefore = new Set(document.querySelectorAll('.html2canvas-container'));
  try {
    const capture = html2canvas(root, {
      backgroundColor: null,
      foreignObjectRendering: true,
      logging: false,
      removeContainer: false,
      scale,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
      // The capture now typically runs while the sign-off is PINNED, i.e.
      // while the stage above is still live. Give slow/software rasterizers
      // more headroom than html2canvas's 15s default before giving up.
      imageTimeout: 30_000,
      // html2canvas 1.4's foreignObject inserts a `scale`-pixel origin, then
      // translates x/y twice (once before and once during drawImage). This
      // cancels that offset at ANY capture scale; the identity-render test
      // guards against a one-pixel jump at the paint swap.
      x: scale / (1 + scale),
      y: scale / (1 + scale),
      ignoreElements: (el) =>
        !(el.contains(root) || root.contains(el) || document.head.contains(el)),
      onclone: (doc, clone) => {
        checkAbort(signal);
        // Siblings (including every other GPU canvas) weren't cloned. Put the
        // target at zero in the isolated document instead of retaining its
        // page scroll offset, which may be thousands of pixels below the fold.
        Object.assign(clone.style, {
          position: 'fixed',
          width: `${width}px`,
          height: `${height}px`,
          background: 'transparent',
          // The cloner copies COMPUTED styles, which resolve the physical and
          // logical inset shorthands (inset / inset-block / inset-inline).
          // When the target is fixed mid-viewport at capture time — the pinned
          // sign-off — those resolved values serialize after the intended
          // top/left override and push the fixed clone back below the SVG
          // viewport, rasterizing nothing. Re-assert the box placement last;
          // for an unpinned target this is the same 0/auto it already had.
          margin: '0',
          inset: '0 auto auto 0',
          // GSAP's pin release can leave a leftover pin-translate transform on
          // the live sign-off for a frame (translateY by the pin travel) while
          // it is already back in normal flow. Copying that would rasterize
          // the clone below the SVG viewport; the foreignObject renderer
          // positions the root itself, so a root transform is never meaningful.
          transform: 'none',
        });
        doc.documentElement.style.background = 'transparent';
        doc.body.style.background = 'transparent';
        const style = doc.createElement('style');
        style.textContent = `${fonts}\n* { animation: none !important; transition: none !important; }`;
        clone.prepend(style);
        const glass = clone.querySelector<HTMLElement>('.marquee--credits');
        if (glass) {
          glass.style.backdropFilter = 'none';
          glass.style.setProperty('-webkit-backdrop-filter', 'none');
        }
      },
    });
    cloneFrame = Array.from(document.querySelectorAll('.html2canvas-container'))
      .find((frame) => !framesBefore.has(frame)) ?? null;
    canvas = await capture;
    checkAbort(signal);
    // Reject a tainted OR silently blank foreignObject. Some engines resolve
    // SVG image.onload even when they refuse to paint its HTML. Never hide the
    // real invitation just because an empty canvas was technically returned.
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Snapshot has no readable 2D canvas');
    const title = root.querySelector('.signoff__title-main');
    if (title) {
      const box = root.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const x = Math.max(0, Math.floor((titleBox.left - box.left) * scale));
      const y = Math.max(0, Math.floor((titleBox.top - box.top) * scale));
      const w = Math.min(canvas.width - x, Math.ceil(titleBox.width * scale));
      const h = Math.min(canvas.height - y, Math.ceil(titleBox.height * scale));
      if (w <= 0 || h <= 0) throw new Error('Snapshot headline is outside the raster');
      const pixels = context.getImageData(x, y, w, h).data;
      if (!pixels.some((value, i) => i % 4 === 3 && value > 128)) {
        throw new Error('The browser did not rasterize the sign-off headline');
      }
    } else {
      context.getImageData(0, 0, 1, 1);
    }
    return canvas;
  } catch (error) {
    if (canvas) canvas.width = canvas.height = 0;
    throw error;
  } finally {
    cloneFrame?.remove();
  }
}
