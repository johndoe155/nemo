import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — the canonical shadcn/ui class-name helper (components.json →
 * aliases.utils). Merges conditional class names then de-duplicates
 * conflicting Tailwind utilities, keeping the last one.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
