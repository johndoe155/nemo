import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

/* ---------------------------------------------------------------------------
   Ambience — fixed living background: three parallax nebula blobs drifting at
   different scroll speeds/scales + a vignette that frames the scene.
--------------------------------------------------------------------------- */

function Nebula({ className, range }: { className: string; range: [number, number] }) {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 60, damping: 22, mass: 0.5 });
  const y = useTransform(smooth, [0, 1], range);
  const scale = useTransform(smooth, [0, 1], [1, 1.18]);

  return <motion.div className={`neb ${className}`} style={{ y, scale }} aria-hidden="true" />;
}

export default function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <Nebula className="neb--1" range={[0, 320]} />
      <Nebula className="neb--2" range={[0, -420]} />
      <Nebula className="neb--3" range={[0, 560]} />
      <div className="vignette" />
    </div>
  );
}
