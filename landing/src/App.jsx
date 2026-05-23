import React from 'react';
import ObservabilityDashboard from './components/ObservabilityDashboard';

export default function App() {
  return (
    <div className="relative min-h-screen text-slate-100 bg-[#080b11] font-sans antialiased overflow-hidden selection:bg-blue-500/20 selection:text-blue-200">
      <ObservabilityDashboard />
    </div>
  );
}
