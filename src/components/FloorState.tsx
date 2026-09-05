import { useEffect } from 'react';

export default function FloorState() {
  useEffect(() => {
    const root = document.documentElement;
    const footer = document.querySelector<HTMLElement>('.curtain-footer');
    if (!footer) return;

    let raf = 0;
    let atFloor = false;
    const updateHeight = () => {
      root.style.setProperty('--curtain-footer-height', `${footer.getBoundingClientRect().height}px`);
    };
    const updateFloor = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const bottom = window.scrollY + window.innerHeight;
        const documentBottom = document.documentElement.scrollHeight;
        const next = documentBottom - bottom <= 2;
        if (next !== atFloor) {
          atFloor = next;
          root.classList.toggle('at-floor', atFloor);
        }
      });
    };

    updateHeight();
    updateFloor();
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
      updateFloor();
    });
    resizeObserver.observe(footer);
    window.addEventListener('scroll', updateFloor, { passive: true });
    window.addEventListener('resize', updateFloor, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateFloor);
      window.removeEventListener('resize', updateFloor);
      root.classList.remove('at-floor');
      root.style.removeProperty('--curtain-footer-height');
    };
  }, []);

  return null;
}
