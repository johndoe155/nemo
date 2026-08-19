import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal, SectionHead } from '../components/ui';
import { CHAT_FALLBACKS, CHAT_RULES, PERSONA_GREETING, QUICK_REPLIES } from '../lib/data';

interface Msg {
  who: 'nemo' | 'user';
  text: string;
}

function replyFor(input: string): string[] {
  for (const rule of CHAT_RULES) {
    if (rule.match.test(input)) return rule.reply;
  }
  return [CHAT_FALLBACKS[Math.floor(Math.random() * CHAT_FALLBACKS.length)]];
}

export default function Persona() {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'nemo', text: PERSONA_GREETING }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { who: 'user', text: clean }]);
    setInput('');
    setTyping(true);
    const replies = replyFor(clean);
    replies.forEach((r, i) => {
      window.setTimeout(() => {
        setMsgs((m) => [...m, { who: 'nemo', text: r }]);
        if (i === replies.length - 1) setTyping(false);
      }, 550 + i * 750);
    });
  };

  return (
    <section className="section persona" id="persona">
      <div className="gridplane" />
      <div className="shell persona__grid">
        <div className="persona__copy">
          <SectionHead
            num="02"
            kicker="02 · PILLAR 4 — THE AI PERSONA"
            title={
              <>
                The voice that <span className="txt-grad">teases</span> every universe
              </>
            }
            sub={
              <>
                An AI-driven persona that speaks and interacts as the OC — active on X even when the
                creator isn't posting. The Nemoverse's drop schedule is its built-in content
                calendar.
              </>
            }
          />
          <Reveal delay={0.1}>
            <p className="lede">
              <b>Teasers</b> hint at the next universe before it drops. <b>Banter</b> runs between
              the OC and its alternate selves. <b>Drafting</b> turns a topic into in-character posts
              for review. And this <b>chatbot</b> answers questions about specific universes, right
              here on the Hub.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="persona__cap">
              <span className="pulse-dot" />
              <span>
                <b>BUILT ON THE CLAUDE API</b> with a custom persona system prompt — voice, backstory
                and tone. Clear content guardrails keep the character on-brand. Rate-limited, no
                persistent memory required. <em>This demo runs on a canned in-canon brain; swap the
                reply engine for the real API.</em>
              </span>
            </div>
          </Reveal>
        </div>

        <div className="persona__chatwrap">
        <Reveal delay={0.12} y={36}>
          <div className="chat__echo" aria-hidden="true" />
          <div className="chat__echo chat__echo--2" aria-hidden="true" />
          <div className="card chat brackets">
            <div className="chat__bar">
              <span className="msg__ava">N</span>
              <span className="who">
                <b>NEMO</b>
                <span>
                  <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#7dffb0', display: 'inline-block' }} />
                  ONLINE — IN CHARACTER
                </span>
              </span>
              <span className="chat__dots">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="chat__scroll" ref={scrollRef} aria-live="polite">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  className={`msg ${m.who === 'user' ? 'msg--user' : ''}`}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="msg__ava">{m.who === 'user' ? 'U' : 'N'}</span>
                  <span className="msg__bubble">
                    {m.text.split('\n').map((line, li) =>
                      line.startsWith('[ ') ? (
                        <span className="sys" key={li}>
                          {line}
                          <br />
                        </span>
                      ) : (
                        <span key={li}>
                          {line}
                          <br />
                        </span>
                      ),
                    )}
                  </span>
                </motion.div>
              ))}
              {typing && (
                <div className="msg">
                  <span className="msg__ava">N</span>
                  <span className="msg__bubble" style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0.9rem 1.1rem' }}>
                    <i className="typing-dot" />
                    <i className="typing-dot" />
                    <i className="typing-dot" />
                  </span>
                </div>
              )}
            </div>

            <div className="chat__quick">
              {QUICK_REPLIES.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>

            <form
              className="chat__form"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ask NEMO anything in canon…"
                aria-label="Message NEMO"
                maxLength={280}
              />
              <button type="submit" className="btn btn-primary chat__send" disabled={typing}>
                SEND
              </button>
            </form>

            <p className="chat__disclaimer">PERSONA RESPONSES ARE GENERATIVE · CANON-ONLY GUARDRAILS ON</p>
          </div>
        </Reveal>
        </div>
      </div>
    </section>
  );
}
