import React from 'react';
import { AlertCircle, Calendar, Download, RefreshCw } from 'lucide-react';

export default function IncidentTimeline({ incidents, onExportJSON, loading = false }) {
  
  const getLevelStyles = (level) => {
    if (level === 'critical') {
      return 'bg-rose-950/40 border-rose-500/20 text-rose-400';
    }
    if (level === 'warning') {
      return 'bg-amber-950/40 border-amber-500/20 text-amber-400';
    }
    return 'bg-blue-950/40 border-blue-500/20 text-blue-400';
  };

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm space-y-4">
      
      {/* Panel Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#1e293b]/60">
        <div className="space-y-0.5">
          <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
            Live Incident Timeline
          </span>
          <h3 className="text-xs font-bold text-slate-200">Chronological Telemetry Anomalies</h3>
        </div>
        
        {incidents.length > 0 && (
          <button 
            onClick={onExportJSON}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#1e293b] bg-[#0c101b] hover:bg-[#1a202c] text-slate-400 hover:text-white rounded transition-colors text-[9px] font-mono font-bold"
          >
            <Download className="w-3 h-3 text-blue-400" />
            Export JSON
          </button>
        )}
      </div>

      {/* Incident List */}
      {loading ? (
        <div className="space-y-3.5 py-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1e293b] mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-[#1e293b]/60 rounded" />
                <div className="h-3.5 w-full bg-[#1e293b]/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-[10px]">
          # No resolving anomaly events captured in timeline buffer.
        </div>
      ) : (
        <div className="relative pl-4 space-y-4 py-1.5 max-h-[190px] overflow-y-auto pr-1">
          {/* Vertical timeline connector */}
          <div className="absolute left-1.5 top-2.5 bottom-2.5 w-[1px] bg-[#1e293b] z-0" />

          {incidents.map((inc) => (
            <div key={inc.id} className="relative z-10 flex gap-3.5 text-[10px] font-mono">
              
              {/* Chrono Node bullet */}
              <div className={`w-3 h-3 rounded-full border bg-[#0c101b] mt-1 flex-shrink-0 ${
                inc.level === 'critical' 
                  ? 'border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-status-pulse' 
                  : inc.level === 'warning'
                  ? 'border-amber-500'
                  : 'border-blue-500'
              }`} />

              <div className="flex-1 space-y-1 bg-[#080b11]/50 border border-[#1e293b]/40 rounded p-2.5">
                <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold uppercase">
                  <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${getLevelStyles(inc.level)}`}>
                    {inc.level}
                  </span>
                  <span>{inc.ts}</span>
                </div>
                <h4 className="text-xs font-bold text-white font-sans mt-1">{inc.title}</h4>
                <p className="text-slate-400 font-sans font-light leading-relaxed">{inc.desc}</p>
                <div className="pt-1 text-[8px] text-slate-500">
                  Affected Service: <span className="text-slate-400 font-semibold">{inc.service}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      <div className="text-[8px] text-slate-500 font-mono leading-normal pt-1.5 border-t border-[#1e293b]/40">
        📌 Timeline indexes SERVFAIL peaks, NXDOMAIN cascades, and latency outlier bounds automatically.
      </div>
    </div>
  );
}
