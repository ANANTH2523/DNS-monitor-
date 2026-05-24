import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function LightweightIntro({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-[#06080d] z-50 flex flex-col items-center justify-center font-mono select-none">
      
      {/* Subtle grid layer */}
      <div className="absolute inset-0 bg-grid-observability opacity-20 pointer-events-none" />

      {/* Main concentric circle pulse effect */}
      <div className="relative flex items-center justify-center">
        
        {/* Ring 1 (Ping pulse) */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.8, opacity: [0.15, 0.4, 0] }}
          transition={{ duration: 1.8, ease: 'easeOut', repeat: 0 }}
          className="absolute w-24 h-24 rounded-full border border-blue-500/40 bg-blue-500/5 pointer-events-none"
        />

        {/* Shield Logo container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-16 h-16 rounded-xl bg-[#0f1422] border border-[#1e293b] flex items-center justify-center shadow-lg relative z-10"
        >
          <Shield className="w-8 h-8 text-blue-500" />
        </motion.div>
      </div>

      {/* Brand title reveal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="mt-6 text-center space-y-2 relative z-10"
      >
        <h1 className="text-lg font-bold tracking-widest text-white uppercase">DNS SENTINEL</h1>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">Kubernetes eBPF Resolving Observer</p>
      </motion.div>

      {/* Loading state bar */}
      <div className="w-32 h-1 bg-[#1e293b] rounded-full overflow-hidden mt-8 relative z-10">
        <motion.div 
          initial={{ left: '-100%' }}
          animate={{ left: '100%' }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: 0 }}
          className="absolute h-full w-1/2 bg-blue-500 rounded-full"
        />
      </div>

    </div>
  );
}
