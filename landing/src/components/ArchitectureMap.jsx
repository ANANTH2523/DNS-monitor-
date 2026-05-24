import { Cpu, Radio, Shield, Database, Sliders } from 'lucide-react';

export default function ArchitectureMap() {
  return (
    <div className="bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-[#1e293b] rounded-lg p-5 shadow-sm space-y-5">
      
      {/* Header */}
      <div>
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold">BPF Network Topology Flow</span>
        <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">eBPF Socket Interception & Metrics Pipeline</h3>
      </div>

      {/* Vector Block Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch max-w-4xl mx-auto text-center font-mono text-[10px]">
        
        {/* Step 1 */}
        <div className="p-4 bg-slate-50 dark:bg-[#080b11]/60 border border-slate-200 dark:border-[#1e293b] rounded-lg flex flex-col justify-between hover:border-slate-300 dark:border-[#334155] transition-all">
          <Cpu className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white uppercase text-[9px] tracking-wider mb-1">1. User App</p>
            <p className="text-[9px] text-slate-500 leading-relaxed font-sans font-light">Generates core microservice resolving traffic inside Pod namespace.</p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="p-4 bg-slate-50 dark:bg-[#080b11]/60 border border-slate-200 dark:border-[#1e293b] rounded-lg flex flex-col justify-between hover:border-slate-300 dark:border-[#334155] transition-all">
          <Radio className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white uppercase text-[9px] tracking-wider mb-1">2. eBPF Filter</p>
            <p className="text-[9px] text-slate-500 leading-relaxed font-sans font-light">BPF raw socket filter monitors packet transfers on local interface.</p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="p-4 bg-slate-50 dark:bg-[#080b11]/60 border border-slate-200 dark:border-[#1e293b] rounded-lg flex flex-col justify-between border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:border-slate-300 dark:border-[#334155] transition-all">
          <Shield className="w-5 h-5 text-blue-400 mx-auto mb-2 animate-pulse" />
          <div>
            <p className="font-bold text-blue-400 uppercase text-[9px] tracking-wider mb-1">3. DNS Sentinel</p>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">Sidecar matches 16-bit transaction queries & response timestamps.</p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="p-4 bg-slate-50 dark:bg-[#080b11]/60 border border-slate-200 dark:border-[#1e293b] rounded-lg flex flex-col justify-between hover:border-slate-300 dark:border-[#334155] transition-all">
          <Database className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white uppercase text-[9px] tracking-wider mb-1">4. Prometheus</p>
            <p className="text-[9px] text-slate-500 leading-relaxed font-sans font-light">Scrapes aggregated counters and latency histograms on port :2112.</p>
          </div>
        </div>

        {/* Step 5 */}
        <div className="p-4 bg-slate-50 dark:bg-[#080b11]/60 border border-slate-200 dark:border-[#1e293b] rounded-lg flex flex-col justify-between hover:border-slate-300 dark:border-[#334155] transition-all">
          <Sliders className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white uppercase text-[9px] tracking-wider mb-1">5. Operator UI</p>
            <p className="text-[9px] text-slate-500 leading-relaxed font-sans font-light">Aggregates real-time telemetry, percentiles, and alerts live.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
