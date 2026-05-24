import React from 'react';

export default function MetricCard({ title, value, unit = '', desc, icon: Icon, isError = false, loading = false }) {
  return (
    <div className={`bg-white dark:bg-[#0c101b] border rounded-lg p-4 flex flex-col justify-between shadow-sm relative group hover:border-slate-300 dark:border-[#334155] transition-all duration-300 ${
      isError ? 'border-rose-500/30' : 'border-slate-200 dark:border-[#1e293b]'
    }`}>
      
      {/* Title & Icon Header */}
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold">
          {Icon && <Icon className={`w-3.5 h-3.5 ${isError ? 'text-rose-500' : 'text-blue-500'}`} />}
          {title}
        </span>
      </div>

      {/* Value & Loading representation */}
      <div>
        {loading ? (
          <div className="h-8 w-24 bg-[#1e293b]/60 animate-pulse rounded my-1" />
        ) : (
          <p className={`text-2xl font-bold font-mono tracking-tight ${isError ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
            {value} {unit && <span className="text-xs font-sans text-slate-500 font-normal">{unit}</span>}
          </p>
        )}
      </div>

      {/* Description / Subtext */}
      <div className="flex justify-between items-center text-[9px] text-slate-500 mt-2.5 font-mono leading-none">
        <span>{desc}</span>
      </div>

    </div>
  );
}
