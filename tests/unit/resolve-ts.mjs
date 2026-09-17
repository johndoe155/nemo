import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  if (isRelative && !path.extname(specifier)) {
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(specifier + extension, context);
      } catch {
        // not that extension; try the next one
      }
    }
  }
  return nextResolve(specifier, context);
}
