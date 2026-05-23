import React from 'react';
import { Server, AlertTriangle, XCircle, CheckCircle2, Activity } from 'lucide-react';

const STATUS_CONFIG = {
  Running: {
    dot:    'bg-emerald-400',
    border: 'border-emerald-500/20',
    bg:     'bg-emerald-950/10',
    text:   'text-emerald-400',
    Icon:   CheckCircle2,
  },
  Warning: {
    dot:    'bg-amber-400 animate-pulse',
    border: 'border-amber-500/25',
    bg:     'bg-amber-950/10',
    text:   'text-amber-400',
    Icon:   AlertTriangle,
  },
  CrashLoopBackOff: {
    dot:    'bg-rose-500 animate-pulse',
    border: 'border-rose-500/30',
    bg:     'bg-rose-950/15',
    text:   'text-rose-400',
    Icon:   XCircle,
  },
  Pending: {
    dot:    'bg-blue-400 animate-pulse',
    border: 'border-blue-500/20',
    bg:     'bg-blue-950/10',
    text:   'text-blue-400',
    Icon:   Activity,
  },
};

export default function ClusterHealth({ pods }) {
  const running = pods.filter(p => p.status === 'Running').length;
  const warning = pods.filter(p => p.status === 'Warning').length;
  const crashed = pods.filter(p => p.status === 'CrashLoopBackOff').length;
  const total   = pods.length;

  // Sort: crashed first, then warning, then running
  const sorted = [...pods].sort((a, b) => {
    const order = { CrashLoopBackOff: 0, Warning: 1, Pending: 2, Running: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-blue-500" />
            Kubernetes Pod Registry
          </span>
          <h3 className="text-xs font-bold text-slate-200 mt-0.5">Live Pod Health Matrix</h3>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-3 font-mono text-[9px] flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-bold">
            {running}/{total} Running
          </span>
          {warning > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/20 text-amber-400 font-bold">
              {warning} Warning
            </span>
          )}
          {crashed > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-400 font-bold animate-pulse">
              {crashed} CrashLoop
            </span>
          )}
        </div>
      </div>

      {/* Pod grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3">
        {sorted.map(pod => {
          const cfg = STATUS_CONFIG[pod.status] || STATUS_CONFIG.Running;
          return (
            <div
              key={pod.id}
              className={`p-3.5 border rounded-lg ${cfg.bg} ${cfg.border} font-mono text-[10px] transition-all duration-200 hover:border-opacity-50`}
            >
              {/* Pod name + status badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-white font-semibold truncate">{pod.name}</span>
                </div>
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  {pod.status}
                </span>
              </div>

              {/* Pod stats grid */}
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-[9px] text-slate-500">
                <div>
                  <p className="text-[8px] uppercase tracking-wider">Namespace</p>
                  <p className="text-slate-300 font-semibold mt-0.5">{pod.namespace}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-wider">Restarts</p>
                  <p className={`font-semibold mt-0.5 ${
                    pod.restarts > 5 ? 'text-rose-400' :
                    pod.restarts > 0 ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    {pod.restarts}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-wider">DNS Queries</p>
                  <p className="text-blue-400 font-semibold mt-0.5">{pod.dnsQueries.toLocaleString()}</p>
                </div>
              </div>

              {/* Footer metrics */}
              <div className="flex gap-4 mt-2 pt-2 border-t border-[#1e293b]/40 text-[9px] text-slate-500">
                <span>CPU: <span className={parseInt(pod.cpu) > 70 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>{pod.cpu}</span></span>
                <span>Mem: <span className="text-slate-300">{pod.mem}</span></span>
                <span>Age: <span className="text-slate-300">{pod.age}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend footnote */}
      <div className="text-[8px] text-slate-500 font-mono pt-1 border-t border-[#1e293b]/40 leading-normal">
        🔴 CrashLoopBackOff pods are excluded from DNS routing until health checks pass.
      </div>
    </div>
  );
}
