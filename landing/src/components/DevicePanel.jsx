import React from 'react';
import { Monitor, Smartphone, Tablet, Wifi, Signal, Globe, Zap, Database, AlertTriangle } from 'lucide-react';

// ─── Device detection helpers ──────────────────────────────────────────────
function detectDeviceInfo() {
  const ua  = navigator.userAgent;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

  // Device type
  const isTablet  = /iPad|Android(?!.*Mobile)/i.test(ua);
  const isMobile  = !isTablet && /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  // OS
  let os = 'Unknown';
  if      (/Windows NT 10/i.test(ua))  os = 'Windows 10/11';
  else if (/Windows/i.test(ua))        os = 'Windows';
  else if (/Mac OS X/i.test(ua) && !isMobile) os = 'macOS';
  else if (/Linux/i.test(ua) && !isMobile)    os = 'Linux';
  else if (/Android ([0-9.]+)/.test(ua))      os = `Android ${RegExp.$1.split('.')[0]}`;
  else if (/iPhone OS ([0-9_]+)/.test(ua))    os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/iPad.*OS ([0-9_]+)/.test(ua))     os = `iPadOS ${RegExp.$1.replace(/_/g, '.')}`;

  // Browser
  let browser = 'Unknown';
  if      (/Edg\//i.test(ua))                    browser = 'Edge';
  else if (/OPR\//i.test(ua))                     browser = 'Opera';
  else if (/Chrome\/([0-9]+)/.test(ua))           browser = `Chrome ${RegExp.$1}`;
  else if (/Firefox\/([0-9]+)/.test(ua))          browser = `Firefox ${RegExp.$1}`;
  else if (/Version\/([0-9]+).*Safari/.test(ua))  browser = `Safari ${RegExp.$1}`;

  // Network
  const networkType  = conn?.effectiveType || conn?.type || 'unknown';
  const rtt          = conn?.rtt      != null ? conn.rtt      : null;
  const downlink     = conn?.downlink != null ? conn.downlink : null;

  return { deviceType, os, browser, networkType, rtt, downlink };
}

// Map network type to a quality label
function networkQuality(type, rtt) {
  if (type === 'wifi' || type === 'ethernet') return { label: 'Excellent', color: 'text-emerald-400' };
  if (type === '4g')   return { label: 'Good',   color: 'text-blue-400'   };
  if (type === '3g')   return { label: 'Fair',   color: 'text-amber-400'  };
  if (type === '2g' || type === 'slow-2g') return { label: 'Poor', color: 'text-rose-400' };
  if (rtt !== null) {
    if (rtt < 50)  return { label: 'Excellent', color: 'text-emerald-400' };
    if (rtt < 150) return { label: 'Good',      color: 'text-blue-400'    };
    if (rtt < 350) return { label: 'Fair',      color: 'text-amber-400'   };
    return               { label: 'Poor',       color: 'text-rose-400'    };
  }
  return { label: 'Unknown', color: 'text-slate-500' };
}

export default function DevicePanel({ sessionId, apiLatency, browserDnsLatency, isApiConnected, realQueryCount }) {
  const info = React.useMemo(() => detectDeviceInfo(), []);
  const quality = networkQuality(info.networkType, info.rtt);

  const DeviceIcon = info.deviceType === 'Mobile'  ? Smartphone
                   : info.deviceType === 'Tablet'  ? Tablet
                   : Monitor;

  const netLabel = info.networkType === 'unknown' ? '—'
                 : info.networkType.toUpperCase();

  return (
    <div className="bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-[#1e293b] rounded-lg p-5 shadow-sm space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold flex items-center gap-1.5">
            <DeviceIcon className="w-3.5 h-3.5 text-blue-500" />
            Device & Session Context
          </span>
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">This Device — Live Monitoring Session</h3>
        </div>
        {/* API connection status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold uppercase ${
          isApiConnected
            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-950/40 border-amber-500/20 text-amber-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isApiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          {isApiConnected ? 'Live DNS Data' : 'Simulated Data'}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[10px]">

        {/* Session ID */}
        <div className="col-span-2 sm:col-span-3 p-3 bg-blue-950/15 border border-blue-500/15 rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1">Your Unique Session ID</p>
          <p className="text-blue-400 font-bold text-xs tracking-widest">{sessionId || '—'}</p>
          <p className="text-[8px] text-slate-600 mt-1">
            Stored in sessionStorage. Each browser/device gets a different ID.
            Close and reopen the tab to get a new session.
          </p>
        </div>

        {/* Device */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Device</p>
          <div className="flex items-center gap-1.5">
            <DeviceIcon className="w-3 h-3 text-blue-400" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">{info.deviceType}</span>
          </div>
        </div>

        {/* OS */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Operating System</p>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{info.os}</span>
        </div>

        {/* Browser */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Browser</p>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{info.browser}</span>
        </div>

        {/* Network type */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">
            <Wifi className="w-2.5 h-2.5 inline mr-1" />Network Type
          </p>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{netLabel}</span>
        </div>

        {/* RTT */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">
            <Signal className="w-2.5 h-2.5 inline mr-1" />Network RTT
          </p>
          <span className="text-slate-800 dark:text-slate-200 font-bold">
            {info.rtt !== null ? `${info.rtt}ms` : '—'}
          </span>
        </div>

        {/* Downlink */}
        <div className="p-3 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded-lg">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Downlink</p>
          <span className="text-slate-800 dark:text-slate-200 font-bold">
            {info.downlink !== null ? `${info.downlink} Mbps` : '—'}
          </span>
        </div>
      </div>

      {/* Real timing measurements */}
      <div className="border-t border-slate-200 dark:border-[#1e293b]/40 pt-4 space-y-3">
        <p className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold">
          Real Performance Measurements — This Device
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* API round-trip latency */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#080b11] space-y-1">
            <p className="text-[8px] text-slate-500 uppercase tracking-wider">
              <Zap className="w-2.5 h-2.5 inline mr-1" />API Round-Trip
            </p>
            <p className={`text-xl font-black font-mono ${
              apiLatency === null    ? 'text-slate-600' :
              apiLatency < 100      ? 'text-emerald-400' :
              apiLatency < 300      ? 'text-blue-400' :
              apiLatency < 600      ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {apiLatency !== null ? `${Math.round(apiLatency)}ms` : '—'}
            </p>
            <p className="text-[8px] text-slate-600">
              {apiLatency !== null
                ? 'Time for your device to reach the DNS probe server'
                : 'Waiting for first probe…'}
            </p>
          </div>

          {/* Browser-side DNS timing */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#080b11] space-y-1">
            <p className="text-[8px] text-slate-500 uppercase tracking-wider">
              <Globe className="w-2.5 h-2.5 inline mr-1" />Browser DNS Timing
            </p>
            <p className={`text-xl font-black font-mono ${
              browserDnsLatency === null ? 'text-slate-600' :
              browserDnsLatency < 10    ? 'text-emerald-400' :
              browserDnsLatency < 50    ? 'text-blue-400' :
              browserDnsLatency < 150   ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {browserDnsLatency !== null ? `${Math.round(browserDnsLatency)}ms` : '—'}
            </p>
            <p className="text-[8px] text-slate-600">
              Real DNS lookup time measured by your browser's Performance API
            </p>
          </div>

          {/* Network quality */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#080b11] space-y-1">
            <p className="text-[8px] text-slate-500 uppercase tracking-wider">Network Quality</p>
            <p className={`text-xl font-black font-mono ${quality.color}`}>
              {quality.label}
            </p>
            <p className="text-[8px] text-slate-600">
              Estimated from network type + RTT + API latency
            </p>
          </div>
        </div>
      </div>

      {/* Session stats */}
      <div className="border-t border-slate-200 dark:border-[#1e293b]/40 pt-4">
        <p className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold mb-3">
          Session Statistics — Accumulated This Session Only
        </p>
        <div className="flex flex-wrap gap-4 text-[10px] font-mono text-slate-600 dark:text-slate-400">
          <span>
            <Database className="w-3 h-3 inline text-blue-500 mr-1" />
            Real DNS probes: <span className="text-slate-900 dark:text-white font-bold">{realQueryCount}</span>
          </span>
          <span>
            Session started: <span className="text-slate-700 dark:text-slate-300 font-bold">{
              (() => {
                const ts = sessionStorage.getItem('dns-sentinel-start');
                if (!ts) return '—';
                const d = new Date(parseInt(ts));
                return d.toLocaleTimeString();
              })()
            }</span>
          </span>
        </div>
      </div>

      {/* Explanation */}
      {!isApiConnected && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[10px] text-amber-300 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>
            <strong>API unreachable.</strong> Running in simulation mode.
            Deploy to Vercel or run the dev server to enable real DNS probing.
          </span>
        </div>
      )}
    </div>
  );
}
