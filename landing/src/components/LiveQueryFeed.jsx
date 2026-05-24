import { useState, useMemo } from 'react';
import { Search, Layers, Filter, Download, Terminal, Tag } from 'lucide-react';

export default function LiveQueryFeed({ logs, loading = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // --- FILTERED LIVE LOGS MEMOIZATION ---
  const filteredQueries = useMemo(() => {
    return logs.filter(q => {
      // 1. Search Query Match
      if (searchQuery && !q.domain.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // 2. Namespace Match
      if (selectedNamespace !== 'all' && q.namespace !== selectedNamespace) {
        return false;
      }
      // 3. Status Match
      if (statusFilter !== 'all') {
        if (statusFilter === 'success' && q.status !== 'OK') return false;
        if (statusFilter === 'error' && q.status !== 'ERROR') return false;
      }
      // 4. Record Type Match
      if (selectedType !== 'all' && q.type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [logs, searchQuery, selectedNamespace, statusFilter, selectedType]);

  // --- NATIVE CSV LOGS EXPORT ENGINE ---
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Namespace', 'PodSource', 'TargetDomain', 'RecordType', 'Latency(ms)', 'RCODE', 'Status'];
    const rows = filteredQueries.map(q => [
      q.ts, q.namespace, q.pod, q.domain, q.type, q.latency, q.rcode, q.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    
    // Compile Blob & download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dns_sentinel_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-5 rounded-lg bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-[#1e293b] space-y-4 shadow-sm">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-[#1e293b]">
        <div className="space-y-0.5 text-left">
          <span className="text-[9px] font-mono uppercase tracking-widest text-blue-500 font-bold">Query Telemetry Stream</span>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sans">Filter & Search Real-Time DNS Resolver Packets</h3>
        </div>
        
        {filteredQueries.length > 0 && (
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-[#1e293b] bg-slate-50 dark:bg-[#080b11] hover:bg-[#1a202c] hover:border-slate-300 dark:border-[#334155] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white rounded transition-colors text-[9px] font-mono font-bold self-end sm:self-auto"
          >
            <Download className="w-3 h-3 text-blue-400" />
            Export CSV Dataset
          </button>
        )}
      </div>

      {/* Observability Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[10px]">
        
        {/* Search target domain input */}
        <div className="relative flex items-center bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 outline-none w-full placeholder-slate-600 text-[10px]"
          />
        </div>

        {/* Namespace Filter dropdown */}
        <div className="flex items-center bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded px-2.5 py-1.5 text-slate-600 dark:text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <span className="mr-1 text-slate-500">NS:</span>
          <select 
            value={selectedNamespace} 
            onChange={(e) => setSelectedNamespace(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer w-full text-[10px]"
          >
            <option value="all">All Namespaces</option>
            <option value="default">default</option>
            <option value="kube-system">kube-system</option>
            <option value="production">production</option>
            <option value="monitoring">monitoring</option>
          </select>
        </div>

        {/* Status code filter dropdown */}
        <div className="flex items-center bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded px-2.5 py-1.5 text-slate-600 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <span className="mr-1 text-slate-500">Status:</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer w-full text-[10px]"
          >
            <option value="all">All Logs</option>
            <option value="success">Success (OK)</option>
            <option value="error">Errors Only</option>
          </select>
        </div>

        {/* Record Type filter dropdown */}
        <div className="flex items-center bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] rounded px-2.5 py-1.5 text-slate-600 dark:text-slate-400">
          <Tag className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <span className="mr-1 text-slate-500">Type:</span>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer w-full text-[10px]"
          >
            <option value="all">All Types</option>
            <option value="A">A records</option>
            <option value="AAAA">AAAA records</option>
            <option value="TXT">TXT records</option>
            <option value="MX">MX records</option>
          </select>
        </div>

      </div>

      {/* Grid Datagrid table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-[#1e293b]/60 rounded-lg">
        <table className="w-full text-left font-mono text-[10px] text-slate-700 dark:text-slate-300">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1e293b] bg-[#090c15] text-slate-500 font-bold uppercase tracking-wider text-[9px]">
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Namespace</th>
              <th className="py-2.5 px-4">Pod source</th>
              <th className="py-2.5 px-4">Target domain</th>
              <th className="py-2.5 px-4 text-center">Type</th>
              <th className="py-2.5 px-4 text-right">Latency</th>
              <th className="py-2.5 px-4 text-center">RCODE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/40">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse bg-white dark:bg-[#0c101b]">
                  <td colSpan="7" className="py-3 px-4">
                    <div className="h-3.5 bg-[#1e293b]/50 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : filteredQueries.length > 0 ? (
              filteredQueries.map((log) => (
                <tr key={log.id} className="hover:bg-[#121824]/40 transition-colors">
                  <td className="py-3 px-4 text-slate-500">{log.ts}</td>
                  <td className="py-3 px-4">
                    <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-[#1e293b] font-bold text-slate-600 dark:text-slate-400">
                      {log.namespace}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{log.pod}</td>
                  <td className={`py-3 px-4 font-semibold truncate max-w-xs ${log.status === 'ERROR' ? 'text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {log.domain}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-500 font-bold">{log.type}</td>
                  <td className={`py-3 px-4 text-right font-medium ${log.latency > 1000 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}`}>
                    {log.latency}ms
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase ${
                      log.status === 'ERROR' ? 'bg-rose-950/40 text-rose-500 border border-rose-500/20' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {log.rcode}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="py-8 px-4 text-center text-slate-500">
                  # No active DNS telemetry packets matched the filter queries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
