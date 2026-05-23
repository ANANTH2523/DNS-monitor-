import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PitchPage from './components/PitchPage';
import ObservabilityDashboard from './components/ObservabilityDashboard';

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <div className="relative min-h-screen text-slate-100 bg-[#080b11] font-sans antialiased selection:bg-blue-500/20 selection:text-blue-200">
      <AnimatePresence mode="wait">
        {showDashboard ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen"
          >
            <ObservabilityDashboard />
          </motion.div>
        ) : (
          <motion.div
            key="pitch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PitchPage onLaunchDashboard={() => setShowDashboard(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
