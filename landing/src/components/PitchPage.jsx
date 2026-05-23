import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Shield, Zap, Activity, Database, AlertTriangle, CheckCircle,
  ArrowRight, Terminal, Cpu, Radio, BarChart3, Server,
  Layers, Globe, Lock, GitBranch, ExternalLink, Eye
} from 'lucide-react';

// ─── Colour config maps (no dynamic Tailwind classes) ────────────────────────
const FEAT_COLORS = {
  blue:    { card: 'hover:border-blue-500/30',    icon: 'bg-blue-500/10 border-blue-500/20',    txt: 'text-blue-400'    },
  purple:  { card: 'hover:border-purple-500/30',  icon: 'bg-purple-500/10 border-purple-500/20', txt: 'text-purple-400'  },
  emerald: { card: 'hover:border-emerald-500/30', icon: 'bg-emerald-500/10 border-emerald-500/20',txt: 'text-emerald-400' },
  rose:    { card: 'hover:border-rose-500/30',    icon: 'bg-rose-500/10 border-rose-500/20',    txt: 'text-rose-400'    },
  amber:   { card: 'hover:border-amber-500/30',   icon: 'bg-amber-500/10 border-amber-500/20',  txt: 'text-amber-400'   },
  cyan:    { card: 'hover:border-cyan-500/30',    icon: 'bg-cyan-500/10 border-cyan-500/20',    txt: 'text-cyan-400'    },
};

const STEP_STYLES = [
  { grad: 'from-blue-500/10',   bdr: 'border-blue-500/20',   ib: 'bg-blue-500/10 border-blue-500/20',   ic: 'text-blue-400',   shadow: ''                                          },
  { grad: 'from-purple-500/10', bdr: 'border-purple-500/30', ib: 'bg-purple-500/10 border-purple-500/20',ic: 'text-purple-400', shadow: 'shadow-[0_0_30px_rgba(168,85,247,0.12)]'  },
  { grad: 'from-emerald-500/10',bdr: 'border-emerald-500/20',ib: 'bg-emerald-500/10 border-emerald-500/20',ic:'text-emerald-400',shadow: ''                                         },
];

// ─── Animated number counter ─────────────────────────────────────────────────
function Counter({ target, suffix = '', prefix = '', decimals = 0, duration = 2.5 }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t0 = Date.now();
    const ms = duration * 1000;
    const tick = () => {
      const p = Math.min((Date.now() - t0) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);          // ease-out cubic
      setCount(parseFloat((e * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration, decimals]);

  return (
    <span ref={ref}>
      {prefix}{decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}{suffix}
    </span>
  );
}

// ─── Architecture node ───────────────────────────────────────────────────────
function ArchNode({ icon: Icon, label, sub, highlight = false, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.12, duration: 0.45 }}
      className={`flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl border min-w-[90px] transition-all ${
        highlight
          ? 'bg-blue-950/40 border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.2)]'
          : 'bg-[#0c101b] border-[#1e293b]'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        highlight ? 'bg-blue-500/20 ring-1 ring-blue-500/30' : 'bg-[#1e293b]'
      }`}>
        <Icon className={`w-5 h-5 ${highlight ? 'text-blue-400' : 'text-slate-400'}`} />
      </div>
      <div className="text-center">
        <p className={`text-[10px] font-bold font-mono uppercase tracking-wider ${highlight ? 'text-blue-300' : 'text-slate-300'}`}>{label}</p>
        {sub && <p className="text-[8px] text-slate-500 mt-0.5 font-mono">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Animated flow connector ─────────────────────────────────────────────────
function Connector({ index = 0 }) {
  return (
    <div className="flex-1 flex items-center min-w-[18px] max-w-[48px] overflow-hidden relative">
      <div className="w-full h-px bg-[#1e293b] relative overflow-hidden rounded">
        <motion.div
          animate={{ x: ['-150%', '350%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear', delay: index * 0.3 }}
          className="absolute top-1/2 -translate-y-1/2 w-4 h-[3px] rounded-full bg-blue-400"
          style={{ boxShadow: '0 0 8px rgba(96,165,250,0.9)', left: 0 }}
        />
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color = 'blue', index = 0 }) {
  const c = FEAT_COLORS[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index % 3) * 0.1, duration: 0.5 }}
      className={`p-5 rounded-xl border border-[#1e293b] bg-[#0c101b]/60 backdrop-blur transition-all duration-300 ${c.card} hover:border-opacity-60 group`}
    >
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${c.icon}`}>
        <Icon className={`w-5 h-5 ${c.txt}`} />
      </div>
      <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed font-light">{desc}</p>
    </motion.div>
  );
}

// ─── Main Pitch Page ─────────────────────────────────────────────────────────
export default function PitchPage({ onLaunchDashboard }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 font-sans overflow-x-hidden">

      {/* ══ STICKY NAV ══════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#080b11]/90 backdrop-blur-md border-b border-[#1e293b] shadow-xl' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <span className="font-bold text-white tracking-tight font-mono text-sm">DNS Sentinel</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/ANANTH2523/DNS-monitor-"
              target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors font-mono"
            >
              <GitBranch className="w-3.5 h-3.5" /> GitHub
            </a>
            <a
              href="#architecture"
              className="hidden sm:block text-[11px] text-slate-400 hover:text-white transition-colors font-mono"
            >
              Architecture
            </a>
            <button
              onClick={onLaunchDashboard}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.35)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)]"
            >
              Dashboard <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 overflow-hidden">
        {/* BG layers */}
        <div className="absolute inset-0 bg-grid-observability opacity-15 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full bg-blue-700/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-purple-700/7 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[250px] h-[250px] rounded-full bg-blue-400/5 blur-[60px] pointer-events-none" />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/25 text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Hackathon Demo · Zero-Instrumentation DNS Observability
        </motion.div>

        {/* Main title */}
        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1 }}
          className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white mb-5 leading-none"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          DNS{' '}
          <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 bg-clip-text text-transparent">
            Sentinel
          </span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg sm:text-2xl text-slate-400 max-w-2xl mb-4 font-light leading-relaxed"
        >
          Real-Time DNS Intelligence for Kubernetes
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-sm text-slate-500 max-w-xl mb-10 font-light"
        >
          A zero-instrumentation eBPF sidecar that captures every DNS query at the kernel level —
          <span className="text-slate-300"> no code changes, no proxies, no overhead.</span>
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-14"
        >
          <motion.button
            onClick={onLaunchDashboard}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_35px_rgba(59,130,246,0.45)] hover:shadow-[0_0_50px_rgba(59,130,246,0.65)] text-sm"
          >
            <Activity className="w-4 h-4" /> Launch Live Dashboard
          </motion.button>
          <a
            href="#architecture"
            className="flex items-center gap-2 px-7 py-3.5 border border-[#1e293b] hover:border-[#334155] text-slate-300 hover:text-white font-medium rounded-xl transition-all text-sm"
          >
            View Architecture <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Live micro-stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-slate-500"
        >
          {[
            { dot: 'bg-emerald-400', text: '512,408+ queries captured'  },
            { dot: 'bg-blue-400',    text: '<12ms avg resolve latency'  },
            { dot: 'bg-purple-400',  text: '8 Kubernetes pods monitored' },
            { dot: 'bg-amber-400',   text: '99.4% cluster health'        },
          ].map(({ dot, text }, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-status-pulse`} />
              {text}
            </span>
          ))}
        </motion.div>

        {/* Scroll chevron */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-slate-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </section>

      {/* ══ PROBLEM ════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* Left: copy */}
          <div>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-mono uppercase tracking-widest text-rose-500 font-bold mb-3 block"
            >
              The Problem
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              DNS is the nervous system of Kubernetes.
              <span className="text-rose-400"> It&apos;s also completely invisible.</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-slate-400 leading-relaxed mb-8 font-light"
            >
              Every microservice call starts with a DNS lookup. Thousands of queries per second flow through
              your cluster. When something breaks — a SERVFAIL cascade, an NXDOMAIN storm, a latency spike —
              engineers are completely blind. Debugging takes hours.
            </motion.p>
            <div className="space-y-3">
              {[
                { color: 'bg-rose-950/30 border-rose-500/20 text-rose-400',   text: 'No visibility into per-pod DNS latency or failure rates' },
                { color: 'bg-amber-950/30 border-amber-500/20 text-amber-400', text: 'DNS-based attacks (tunneling, exfiltration) go undetected' },
                { color: 'bg-orange-950/30 border-orange-500/20 text-orange-400', text: 'NXDOMAIN storms silently degrade the entire cluster' },
              ].map(({ color, text }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border ${color} border-opacity-20`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: fake "before" terminal */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#090c13] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e293b] bg-[#0c101b]">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <span className="text-[9px] text-slate-500 font-mono ml-2">kubectl logs coredns-pod — BEFORE DNS Sentinel</span>
            </div>
            <div className="p-4 font-mono text-[9.5px] space-y-1.5 leading-relaxed">
              {[
                { msg: '[INFO] 10.244.0.5:54321 - "A IN api.stripe.com." NOERROR 0.001234s',                    c: 'text-slate-400' },
                { msg: '[INFO] 10.244.0.6:58221 - "A IN broken-api.internal.local." SERVFAIL 3.514s',           c: 'text-rose-400'  },
                { msg: '[INFO] 10.244.0.7:12445 - "TXT IN suspicious-payload-data.xyz." NXDOMAIN 0.503s',       c: 'text-amber-400' },
                { msg: '[INFO] 10.244.0.5:54400 - "A IN google.com." NOERROR 0.004s',                           c: 'text-slate-400' },
                { msg: '[INFO] 10.244.0.8:31001 - "A IN broken-api.internal.local." SERVFAIL 3.512s',           c: 'text-rose-400'  },
                { msg: '[INFO] 10.244.0.5:54502 - "AAAA IN slack.com." NOERROR 0.018s',                         c: 'text-slate-400' },
              ].map(({ msg, c }, i) => (
                <div key={i} className={c}>{msg}</div>
              ))}
              <div className="pt-2.5 border-t border-[#1e293b] mt-1 text-slate-600 italic text-[9px]">
                ↑ Raw CoreDNS logs. No latency analysis. No anomaly detection. No per-pod attribution.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ ANIMATED STATS ════════════════════════════════════════════════ */}
      <section className="py-16 border-y border-[#1e293b] bg-[#0c101b]/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
          {[
            { prefix: '',  target: 512408, suffix: '+',   decimals: 0, label: 'DNS Queries Captured',   sub: 'live from eBPF sockets',   color: 'text-blue-400'    },
            { prefix: '<', target: 12,     suffix: 'ms',  decimals: 0, label: 'Average Resolve Time',   sub: 'p50 latency baseline',     color: 'text-emerald-400' },
            { prefix: '',  target: 99.4,   suffix: '%',   decimals: 1, label: 'Cluster Health Score',   sub: 'live eBPF health probe',   color: 'text-purple-400'  },
            { prefix: '',  target: 100,    suffix: '%',   decimals: 0, label: 'Zero Instrumentation',   sub: 'no code changes needed',   color: 'text-amber-400'   },
          ].map(({ prefix, target, suffix, decimals, label, sub, color }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className={`text-4xl sm:text-5xl font-black font-mono ${color} mb-1.5`}>
                <Counter target={target} suffix={suffix} prefix={prefix} decimals={decimals} />
              </p>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">{sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ SOLUTION — HOW IT WORKS ═══════════════════════════════════════ */}
      <section className="py-28 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold mb-3 block"
          >
            The Solution
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-black text-white mb-4"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Complete DNS visibility in{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              one sidecar
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-slate-400 max-w-2xl mx-auto font-light text-sm"
          >
            DNS Sentinel deploys as a lightweight Kubernetes sidecar. It captures every DNS packet at the
            kernel level using eBPF raw sockets — with zero application changes and zero performance overhead.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', icon: Server,   title: 'Deploy as Sidecar',      desc: 'Add one container to your pod spec. DNS Sentinel co-locates with your app and shares the same Pod network namespace. No cluster-wide changes.' },
            { step: '02', icon: Radio,    title: 'Capture All DNS Traffic', desc: 'eBPF raw sockets intercept every DNS packet on eth0. Queries and responses are matched by 16-bit transaction ID for nanosecond latency measurement.' },
            { step: '03', icon: BarChart3,title: 'Instant Observability',   desc: 'Real-time p50/p95/p99 latency, failure rates per domain, threat detection alerts, and Prometheus metrics exported on :2112.' },
          ].map(({ step, icon: Icon, title, desc }, i) => {
            const s = STEP_STYLES[i];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`relative p-6 rounded-xl border bg-gradient-to-b ${s.grad} to-transparent ${s.bdr} ${s.shadow}`}
              >
                <span className="text-[52px] font-black text-slate-800/60 absolute top-3 right-5 leading-none select-none">{step}</span>
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-5 ${s.ib}`}>
                  <Icon className={`w-5 h-5 ${s.ic}`} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2.5">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-light">{desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ══ ARCHITECTURE ══════════════════════════════════════════════════ */}
      <section id="architecture" className="py-28 px-6 bg-[#090c13] border-y border-[#1e293b]">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold mb-3 block"
            >
              Architecture
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-black text-white mb-4"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              End-to-end DNS observability pipeline
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-slate-400 font-light text-sm max-w-xl mx-auto"
            >
              From kernel-level packet capture to live Grafana-style dashboards in milliseconds.
            </motion.p>
          </div>

          {/* Flow pipeline */}
          <div className="flex items-center justify-center gap-1 overflow-x-auto pb-4 flex-wrap sm:flex-nowrap">
            <ArchNode icon={Cpu}      label="App Container" sub="microservice"    index={0} />
            <Connector index={0} />
            <ArchNode icon={Layers}   label="Shared Net"    sub="Pod network ns"  index={1} />
            <Connector index={1} />
            <ArchNode icon={Shield}   label="DNS Sentinel"  sub="eBPF sidecar"    highlight index={2} />
            <Connector index={2} />
            <ArchNode icon={Radio}    label="Pkt Capture"   sub="raw socket eth0" index={3} />
            <Connector index={3} />
            <ArchNode icon={Database} label="Prometheus"    sub=":2112/metrics"   index={4} />
            <Connector index={4} />
            <ArchNode icon={BarChart3} label="Dashboard"    sub="live UI"         index={5} />
          </div>

          {/* Detail panels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-12">
            {[
              {
                title: 'Sidecar Pattern',
                desc:  'Shares the pod network namespace. No cluster-wide changes, no webhooks, no CRDs. A single container addition to any pod spec.',
                code:  `# pod.yaml
containers:
  - name: my-app
    image: my-app:latest
  - name: dns-sentinel   # ← only this
    image: dns-sentinel:latest
    securityContext:
      capabilities:
        add: ["NET_RAW"]`,
              },
              {
                title: 'Transaction Matching',
                desc:  'Each DNS query carries a 16-bit Transaction ID. DNS Sentinel stores the send timestamp keyed by TxID and computes wall-clock latency on the matching response.',
                code:  `// main.go
queryMap[txID] = time.Now()

// On DNS response packet:
start := queryMap[txID]
latency := time.Since(start)
histogram.Observe(latency.Seconds())
delete(queryMap, txID)`,
              },
              {
                title: 'Prometheus Metrics',
                desc:  'Standard metrics compatible with any Prometheus + Grafana stack. Fully labelled by domain, namespace, pod, rcode, and record type.',
                code:  `# Exported on :2112/metrics
dns_query_duration_seconds{
  domain="api.stripe.com",
  rcode="NOERROR",
  namespace="production",
  type="A"
} 0.012`,
              },
            ].map(({ title, desc, code }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0c101b] border border-[#1e293b] rounded-xl p-5 space-y-3"
              >
                <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">{title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                <div className="bg-[#080b11] border border-[#1e293b] rounded-lg p-3 font-mono text-[9px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {code}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold mb-3 block"
          >
            Features
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-black text-white"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Everything you need to own your DNS layer
          </motion.h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard index={0} color="blue"    icon={Zap}           title="Zero Instrumentation"       desc="No code changes, no library imports, no restart. Works with every language and framework. Simply add the sidecar container." />
          <FeatureCard index={1} color="purple"  icon={Radio}         title="eBPF Packet Capture"        desc="Kernel-level interception via raw sockets. Captures 100% of DNS traffic. Sub-microsecond overhead on the application." />
          <FeatureCard index={2} color="emerald" icon={Activity}      title="Latency Percentiles"        desc="Live p50/p95/p99 per domain, namespace, and pod. Spot tail latency issues before they cascade into service outages." />
          <FeatureCard index={3} color="rose"    icon={AlertTriangle} title="Threat Detection"           desc="Real-time detection of DNS tunneling, NXDOMAIN storms, query burst anomalies, and base64 exfiltration patterns." />
          <FeatureCard index={4} color="amber"   icon={Database}      title="Prometheus Native"          desc="Standard histogram and counter metrics on :2112. Drop into any existing Prometheus + Grafana stack instantly." />
          <FeatureCard index={5} color="cyan"    icon={Server}        title="Kubernetes Native"          desc="Runs as a standard sidecar. Compatible with KIND, EKS, GKE, AKS. No CRDs, no webhooks, no cluster-admin rights." />
        </div>
      </section>

      {/* ══ DASHBOARD PREVIEW ═════════════════════════════════════════════ */}
      <section className="py-16 px-6 bg-[#090c13] border-y border-[#1e293b]">
        <div className="max-w-6xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-bold mb-3 block"
          >
            Live Dashboard
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-black text-white mb-3"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            4 powerful tabs. One unified observability platform.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-slate-400 text-sm font-light mb-10 max-w-xl mx-auto"
          >
            All features run live in the browser — no backend, no API keys.
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { tab: 'Overview',       icon: BarChart3,      col: 'border-blue-500/20 bg-blue-950/10',    items: ['5 live metric cards', 'p50/p95/p99 latency chart', 'QPS sparkline', 'DNS type donut chart', '7d × 24h heatmap', 'RCODE breakdown', 'Top queried domains'] },
              { tab: 'Live DNS Feed',  icon: Terminal,       col: 'border-purple-500/20 bg-purple-950/10', items: ['Real-time query stream', 'Filter by namespace', 'Filter by status', 'Filter by record type', 'Domain search', 'Export CSV dataset'] },
              { tab: 'Security SIEM', icon: Lock,            col: 'border-rose-500/20 bg-rose-950/10',    items: ['Threat detection alerts', 'DNS tunneling detection', 'Quarantine pod terminal', 'Payload inspector modal', 'Incident timeline', 'JSON export'] },
              { tab: 'Infrastructure',icon: Server,          col: 'border-emerald-500/20 bg-emerald-950/10',items: ['K8s pod health matrix', 'Running / Warning / CrashLoop', 'Per-pod DNS query count', 'CPU & memory stats', 'DNS query ranking table', 'Live pod counter update'] },
            ].map(({ tab, icon: Icon, col, items }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`p-5 rounded-xl border text-left ${col}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-bold text-white font-mono uppercase tracking-wider">{tab}</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={onLaunchDashboard}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_35px_rgba(59,130,246,0.4)] hover:shadow-[0_0_50px_rgba(59,130,246,0.6)]"
          >
            <Eye className="w-4 h-4" /> Open Live Dashboard <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </section>

      {/* ══ TECH STACK ════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-8 font-bold"
          >
            Built With
          </motion.p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'Go',            sub: 'DNS sniffer backend'  },
              { label: 'eBPF',          sub: 'Kernel-level capture' },
              { label: 'Raw Sockets',   sub: 'UDP/DNS intercept'    },
              { label: 'Prometheus',    sub: 'Metrics export'       },
              { label: 'React 19',      sub: 'Frontend UI'          },
              { label: 'Vite 8',        sub: 'Build toolchain'      },
              { label: 'Tailwind CSS',  sub: 'Styling'              },
              { label: 'Framer Motion', sub: 'Animations'           },
              { label: 'Kubernetes',    sub: 'Sidecar deployment'   },
              { label: 'KIND',          sub: 'Local K8s cluster'    },
              { label: 'Vercel',        sub: 'Frontend hosting'     },
              { label: 'GitHub',        sub: 'Source code'          },
            ].map(({ label, sub }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="px-3.5 py-2 bg-[#0c101b] border border-[#1e293b] rounded-lg hover:border-[#334155] transition-colors cursor-default text-center"
              >
                <p className="text-[11px] font-bold text-slate-200 font-mono">{label}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-observability opacity-10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full bg-blue-700/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="w-18 h-18 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto mb-7 shadow-[0_0_50px_rgba(59,130,246,0.25)]" style={{ width: 72, height: 72 }}>
              <Shield className="w-9 h-9 text-blue-400" />
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              See it live.{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Right now.</span>
            </h2>
            <p className="text-slate-400 text-lg font-light mb-10 max-w-xl mx-auto leading-relaxed">
              No setup. No API keys. No backend. Just real-time DNS observability running entirely in the browser.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={onLaunchDashboard}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-xl transition-all shadow-[0_0_50px_rgba(59,130,246,0.45)] hover:shadow-[0_0_70px_rgba(59,130,246,0.65)]"
          >
            <Activity className="w-5 h-5" />
            Launch Live Dashboard
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-slate-500 font-mono flex-wrap">
            {[
              'Zero API keys',
              'No backend required',
              'Deployable on Vercel',
              'Open source on GitHub',
            ].map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1e293b] py-6 px-6 bg-[#0c101b]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-bold text-slate-400">DNS Sentinel</span>
            <span>· Zero-Instrumentation DNS Observability for Kubernetes</span>
          </div>
          <a
            href="https://github.com/ANANTH2523/DNS-monitor-"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            github.com/ANANTH2523/DNS-monitor-
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
