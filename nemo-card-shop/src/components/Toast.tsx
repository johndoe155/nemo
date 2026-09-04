import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastPayload = { msg: string; tone?: 'cyan' | 'gold' | 'rose' };

/** Fire a toast — the ToastHost mounted in CardShop renders it. */
export function toast(msg: string, tone: ToastPayload['tone'] = 'cyan') {
  try {
    window.dispatchEvent(
      new CustomEvent<ToastPayload>('nemo-shop:toast', { detail: { msg, tone } }),
    );
  } catch {
    /* noop */
  }
}

interface Item extends ToastPayload {
  id: number;
}

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const { msg, tone } = (e as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-2), { id, msg, tone }]);
      window.setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 3200);
    };
    window.addEventListener('nemo-shop:toast', on);
    return () => window.removeEventListener('nemo-shop:toast', on);
  }, []);

  return (
    <div className="nshop-toasts" aria-live="polite" role="status">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            className={`nshop-toast nshop-toast--${it.tone ?? 'cyan'}`}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="nshop-toast__star" aria-hidden="true">
              ✦
            </span>
            <span className="nshop-toast__txt">{it.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
