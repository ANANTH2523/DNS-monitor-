import React from 'react';

// Record type → ring color
const TYPE_COLORS = {
  A:    '#3b82f6',
  AAAA: '#8b5cf6',
  TXT:  '#f59e0b',
  MX:   '#10b981',
  CNAME:'#f43f5e',
};

function buildSlices(stats) {
  const total  = Object.values(stats).reduce((a, b) => a + b, 0);
  const radius = 42;
  const circ   = 2 * Math.PI * radius;
  let cumPct   = 0;

  return Object.entries(stats).map(([type, count]) => {
    const pct    = total === 0 ? 0 : count / total;
    const offset = circ * (1 - cumPct);   // start position
    cumPct      += pct;
    return {
      type,
      count,
      pct,
      dashArray:  pct * circ,
      dashOffset: offset,
      color: TYPE_COLORS[type] || '#64748b',
    };
  });
}

export default function DnsTypeChart({ recordTypeStats }) {
  const total  = Object.values(recordTypeStats).reduce((a, b) => a + b, 0);
  const cx = 60, cy = 60, r = 42;
  const slices = buildSlices(recordTypeStats);

  return (
    <div className="bg-[#0c101b] border border-[#1e293b] rounded-lg p-5 shadow-sm h-full">
      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold">
          DNS Record Type Distribution
        </span>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        {/* SVG ring chart */}
        <svg width="120" height="120" className="flex-shrink-0">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="18" />
          {/* Segments */}
          {slices.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${s.dashArray} ${2 * Math.PI * r - s.dashArray}`}
              strokeDashoffset={s.dashOffset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.4s ease' }}
            />
          ))}
          {/* Centre label */}
          <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '15px', fontWeight: 700, fill: '#fff', fontFamily: 'monospace' }}>
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: '8px', fill: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            TOTAL
          </text>
        </svg>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 font-mono text-[10px] flex-1 min-w-[110px]">
          {slices.map(s => (
            <div key={s.type} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-300 font-bold">{s.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-14 h-1 bg-[#1e293b] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ width: `${s.pct * 100}%`, backgroundColor: s.color }}
                  />
                </div>
                <span className="text-slate-500 text-[9px] w-7 text-right">{Math.round(s.pct * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
