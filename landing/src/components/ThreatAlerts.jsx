import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, Flame, AlertTriangle, Info, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export default function ThreatAlerts({ 
  threats, 
  threatScore,
  remediatingThreatId, 
  quarantineTerminal, 
  quarantinedPods,
  onQuarantine, 
  onDecode, 
  onMute, 
  loading = false 
}) {

  const getAlertStyles = (threat) => {
    if (quarantinedPods.includes(threat.id)) {
      return 'bg-emerald-950/5 border-emerald-500/10 text-emerald-500 opacity-60';
    }
    if (threat.type === 'critical') {
      return 'bg-rose-950/5 border-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.02)]';
    }
    if (threat.type === 'warning') {
      return 'bg-amber-950/5 border-amber-500/10 text-amber-300';
    }
    return 'bg-blue-950/5 border-blue-500/10 text-blue-300';
  };

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm space-y-4">
      
      {/* SIEM Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#1e293b]/60">
        <div className="space-y-0.5">
          <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5 font-bold">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
            Threat Detection Alerts
          </span>
          <h3 className="text-xs font-bold text-slate-200">Outbound DNS Security Incident Log</h3>
        </div>
        <div className="text-[9px] font-mono text-rose-500 bg-rose-950/30 border border-rose-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          Score: {threatScore}%
        </div>
      </div>

      {/* Threats List */}
      {loading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#1e293b]/40 rounded animate-pulse w-full" />
          ))}
        </div>
      ) : threats.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-[10px]">
          # No active eBPF security warnings captured. Cluster secure.
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {threats.map((threat) => {
            const isQuarantined = quarantinedPods.includes(threat.id);
            return (
              <div 
                key={threat.id} 
                className={`p-3.5 border rounded-lg font-mono text-[10px] flex flex-col gap-3 shadow-inner transition-all duration-300 ${getAlertStyles(threat)}`}
              >
                {/* Alert Core Details */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {isQuarantined ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : threat.type === 'critical' ? (
                      <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                    ) : threat.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>eBPF SIEM bulletin ({threat.type})</span>
                      <span>{threat.ts}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white font-sans flex items-center gap-1.5 mt-0.5">
                      {threat.title}
                    </h4>
                    <p className="text-slate-400 font-sans font-light leading-relaxed text-[10.5px]">{threat.desc}</p>
                    
                    <div className="flex gap-4 pt-1 text-[8.5px] text-slate-500">
                      <span>Source IP: {threat.source}</span>
                      <span>Network Interface: eth0</span>
                    </div>
                  </div>
                </div>

                {/* Remediation Action Links */}
                {!isQuarantined && (
                  <div className="flex items-center gap-2 mt-1 border-t border-[#1e293b]/60 pt-2.5">
                    {remediatingThreatId === threat.id ? (
                      <div className="flex items-center gap-1.5 text-blue-400 font-mono text-[8px] font-bold">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>Injecting isolation Policy rules...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onQuarantine(threat)}
                          className="px-2.5 py-0.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/25 text-rose-400 rounded font-bold text-[8.5px] transition-colors"
                        >
                          Quarantine Pod
                        </button>
                        {threat.type === 'critical' && (
                          <button
                            onClick={() => onDecode(threat)}
                            className="px-2.5 py-0.5 bg-[#1a202c] hover:bg-[#2d3748] border border-[#334155] text-blue-400 rounded font-bold text-[8.5px] transition-colors"
                          >
                            Inspect Payload
                          </button>
                        )}
                        <button
                          onClick={() => onMute(threat)}
                          className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-500 hover:text-slate-300 rounded text-[8.5px] transition-colors"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Inline Remediating terminal logging shell */}
                {remediatingThreatId === threat.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-black border border-rose-950 rounded font-mono text-[8.5px] text-rose-400 space-y-1 leading-normal overflow-hidden shadow-inner w-full"
                  >
                    <div className="flex items-center justify-between border-b border-rose-950 pb-1 mb-1 text-slate-600 font-bold uppercase tracking-wider text-[8px]">
                      <span>Remediation Terminal</span>
                      <span className="animate-pulse">Active</span>
                    </div>
                    <pre className="whitespace-pre-wrap">{quarantineTerminal}</pre>
                  </motion.div>
                )}

              </div>
            );
          })}
        </div>
      )}

      <div className="text-[8px] text-slate-500 font-mono leading-normal pt-1.5 border-t border-[#1e293b]/40">
        🛡️ Quarantine Pod applies a strict denying NetworkPolicy isolating namespaces from SDN routers.
      </div>
    </div>
  );
}
