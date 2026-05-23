import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cellColor(value, max) {
  if (!value || value === 0) return '#0d1117';
  const t = value / max;
  if (t < 0.15) return '#172033';
  if (t < 0.30) return '#1c3460';
  if (t < 0.50) return '#1d4ed8';
  if (t < 0.70) return '#2563eb';
  if (t < 0.85) return '#3b82f6';
  return '#60a5fa';
}

export default function QueryHeatmap({ heatmapData }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...heatmapData.flat(), 1);

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-500" />
          DNS Query Volume — 7d × 24h Heatmap
        </span>
        {hovered ? (
          <span className="text-[9px] font-mono text-blue-400 bg-blue-950/30 border border-blue-500/20 px-2 py-0.5 rounded">
            {DAYS[hovered.day]} {String(hovered.hour).padStart(2, '0')}:00 — {hovered.value} queries
          </span>
        ) : (
          <span className="text-[9px] font-mono text-slate-600">Hover a cell for detail</span>
        )}
      </div>

      {/* Hour axis labels */}
      <div className="flex ml-7 mb-1 gap-px">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-center text-[6px] text-slate-600 font-mono select-none">
            {h % 6 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-px">
        {heatmapData.map((row, d) => (
          <div key={d} className="flex items-center gap-px">
            <span className="text-[7px] text-slate-600 font-mono w-6 text-right pr-1 flex-shrink-0 select-none">
              {DAYS[d]}
            </span>
            {row.map((val, h) => (
              <div
                key={h}
                className="flex-1 rounded-[2px] cursor-crosshair transition-transform duration-75 hover:scale-110 hover:z-10 hover:ring-1 hover:ring-blue-400/60"
                style={{ height: '13px', backgroundColor: cellColor(val, max) }}
                onMouseEnter={() => setHovered({ day: d, hour: h, value: val })}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Colour legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[7px] text-slate-600 font-mono">Low</span>
        {[0.05, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-[2px]"
            style={{ backgroundColor: cellColor(v * max, max) }}
          />
        ))}
        <span className="text-[7px] text-slate-600 font-mono">High</span>
      </div>
    </div>
  );
}
