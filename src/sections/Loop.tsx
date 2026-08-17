import { motion } from 'framer-motion';
import { Reveal } from '../components/ui';
import { LOOP_PILLARS } from '../lib/data';
/* The flywheel: four systems orbiting the Multiverse core. Absolute positioning
   on desktop (orbit), stacked cards on mobile. Positions in percentages of the
   orbit container. */

const POSITIONS = [
  { top: '4%', left: '50%', x: '-50%' },
  { top: '50%', left: '88%', x: '-100%', y: '-50%' },
  { top: 'auto', bottom: '4%', left: '50%', x: '-50%' },
  { top: '50%', left: '12%', x: '0%', y: '-50%' },
];

export default function Loop() {
  return (
    <section className="section loop" id="loop">
      <div className="shell">
        <div className="loop__head">
          <span className="kicker">HOW IT ALL CONNECTS</span>
          <h2 className="display" style={{ fontSize: 'var(--fs-h2)' }}>
            <Reveal>
              One loop. <span className="txt-grad">Nothing wasted.</span>
            </Reveal>
          </h2>
          <Reveal delay={0.12}>
            <p style={{ color: 'var(--ink-dim)', maxWidth: '46rem', margin: '1rem auto 0', fontSize: 'var(--fs-lead)' }}>
              The Persona teases the next universe → fans arrive at the Hub → holders claim first →
              every purchase pulls a piece → fans post the pull → the Persona amplifies → the
              Multiverse grows.
            </p>
          </Reveal>
        </div>

        <div className="loop__orbit">
          <span className="orbit spin" style={{ position: 'absolute', width: 'min(760px, 92%)', aspectRatio: '1' }} />
          <span className="orbit spin-rev" style={{ position: 'absolute', width: 'min(500px, 62%)', aspectRatio: '1' }} />

          <div className="loop__core">
            <div>
              <b>THE</b>
              <b>MULTIVERSE</b>
              <span>the engine</span>
            </div>
          </div>

          {LOOP_PILLARS.map((p, i) => {
            const pos = POSITIONS[i];
            return (
              <motion.a
                key={p.n}
                href={p.target}
                className="loop__node"
                style={
                  {
                    ...pos,
                    '--lc': p.color,
                  }
                }
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="loop__node-in sheen">
                  <span className="n">
                    {p.n} · {p.tag}
                  </span>
                  <b>{p.name}</b>
                  <small>↓</small>
                  <p>{p.body}</p>
                </span>
              </motion.a>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <p className="loop__note">
            ◆ THE DIFFERENCE BETWEEN SCATTERED COMMISSIONS AND{' '}
            <b>ONE GROWING, SELF-FUNDING ECOSYSTEM</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
