/* Lets `node --test` load the app's TypeScript sources directly.

   Node 22 strips types natively, but it will not resolve the extensionless
   relative imports Vite and TypeScript use (`./spaghettification`). This hook
   retries those with the TypeScript extensions before giving up, so the unit
   tests can import the real modules instead of a copy of them. */
import { register } from 'node:module';

register('./resolve-ts.mjs', import.meta.url);
