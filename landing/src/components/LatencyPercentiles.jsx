import React from 'react';
import { Activity } from 'lucide-react';

export default function LatencyPercentiles({ percentiles, loading = false }) {
  const getPercentileColor = (val) => {
    if (val > 100) return 'text-rose-500';
    if (val > 20) return 'text-amber-500';
    return 'text-white';
  };

  const getBarColor = (val) => {
    if (val > 100) return 'bg-rose-500';
    if (val > 20) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-[#1e293b]/60">
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5 font-bold">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          Advanced Timing Percentiles
        </span>
        <span className="text-[8px] font-mono text-slate-500 uppercase">100% BPF snipped</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 pt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-8 bg-[#1e293b] rounded animate-pulse" />
              <div className="h-6 w-16 bg-[#1e293b]/50 rounded animate-pulse" />
              <div className="h-1 bg-[#1e293b] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 pt-1">
          
          {/* p50 (Median) */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase block">p50 median</span>
            <p className="text-xl font-bold font-mono tracking-tight text-white">
              {percentiles.p50} <span className="text-[10px] text-slate-500 font-sans">ms</span>
            </p>
            <div className="w-full h-1 bg-[#1e293b] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (percentiles.p50 / 30) * 100)}%` }} />
            </div>
          </div>

          {/* p95 (Tail Latency) */}
          <div className="space-y-1.5 border-l border-[#1e293b]/60 pl-4">
            <span className="text-[9px] font-mono text-slate-500 uppercase block">p95 tail</span>
            <p className={`text-xl font-bold font-mono tracking-tight ${getPercentileColor(percentiles.p95)}`}>
              {percentiles.p95} <span className="text-[10px] text-slate-500 font-sans">ms</span>
            </p>
            <div className="w-full h-1 bg-[#1e293b] rounded-full overflow-hidden">
              <div className={`h-full ${getBarColor(percentiles.p95)}`} style={{ width: `${Math.min(100, (percentiles.p95 / 30) * 100)}%` }} />
            </div>
          </div>

          {/* p99 (Outliers) */}
          <div className="space-y-1.5 border-l border-[#1e293b]/60 pl-4">
            <span className="text-[9px] font-mono text-slate-500 uppercase block">p99 outlier</span>
            <p className={`text-xl font-bold font-mono tracking-tight ${getPercentileColor(percentiles.p99)}`}>
              {percentiles.p99 > 300 ? '>300' : percentiles.p99} <span className="text-[10px] text-slate-500 font-sans">ms</span>
            </p>
            <div className="w-full h-1 bg-[#1e293b] rounded-full overflow-hidden">
              <div className={`h-full ${getBarColor(percentiles.p99)}`} style={{ width: `${Math.min(100, (percentiles.p99 / 200) * 100)}%` }} />
            </div>
          </div>

        </div>
      )}

      <div className="text-[8px] text-slate-500 font-mono pt-1 leading-normal">
        p99 timings track outliers like DNS resolution path network hops or SERVFAIL timeouts.
      </div>
    </div>
  );
}
