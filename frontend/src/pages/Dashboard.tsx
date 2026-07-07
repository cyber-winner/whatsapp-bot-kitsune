import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Power, RefreshCw, StopCircle, PowerOff, Blocks, Cpu, Activity, Terminal } from 'lucide-react';

export default function Dashboard({ auth }: { auth: string }) {
  const [stats, setStats] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [pm2Procs, setPm2Procs] = useState<any[]>([]);
  const [terminal, setTerminal] = useState<string>('Ready. Waiting for commands...\n');
  const termRef = useRef<HTMLPreElement>(null);

  const log = (msg: string) => {
    setTerminal(prev => `> ${new Date().toLocaleTimeString()}\n${msg}\n\n` + prev);
  };

  const execute = async (action: string, data: any = {}) => {
    log(`Executing ${action}...`);
    try {
      const res = await axios.post('/api/control-centre/execute', { password: auth, action, ...data });
      if (res.data.output) log(res.data.output);
      else if (res.data.message) log(`[SYS]: ${res.data.message}`);
      else if (res.data.success) log(`Success: ${action}`);
      else log(`Error: ${res.data.error || 'Failed'}`);
      
      if (action.includes('toggle') || action.includes('restart') || action.includes('stop')) {
        setTimeout(fetchPm2, 1000);
        setTimeout(fetchModules, 1500);
      }
    } catch (err: any) {
      log(`Network Error: ${err.message}`);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await axios.post('/api/control-centre/execute', { password: auth, action: 'get-modules' });
      if (res.data.success) setModules(res.data.modules);
    } catch (e) {}
  };

  const fetchPm2 = async () => {
    try {
      const res = await axios.post('/api/control-centre/execute', { password: auth, action: 'pm2-jlist' });
      if (res.data.success) setPm2Procs(res.data.processes);
    } catch (e) {}
  };

  const fetchStats = async () => {
    try {
      const res = await axios.post('/api/control-centre/system-stats', { password: auth });
      if (res.data.success) setStats(res.data.stats);
    } catch (e) {}
  };

  useEffect(() => {
    fetchModules();
    fetchPm2();
    fetchStats();
    const intv = setInterval(() => {
      fetchStats();
      fetchPm2();
      fetchModules();
    }, 5000);
    return () => clearInterval(intv);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 rounded-lg p-6 flex flex-col gap-4 border border-zinc-800">
          <h2 className="text-base font-bold flex items-center gap-2 border-b border-zinc-800 pb-2 text-white">
            <Power className="w-5 h-5 text-slate-400" /> System Controls
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => execute('pm2-restart')} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md p-3 text-sm flex flex-col items-center justify-center gap-2 transition-colors text-white font-bold">
              <RefreshCw className="w-5 h-5 text-indigo-400" /> Restart All
            </button>
            <button onClick={() => execute('pm2-stop')} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md p-3 text-sm flex flex-col items-center justify-center gap-2 transition-colors text-white font-bold">
              <StopCircle className="w-5 h-5 text-orange-400" /> Stop All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button onClick={() => execute('pc-shutdown')} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md p-3 text-sm flex flex-col items-center justify-center gap-2 transition-colors text-white font-bold">
              <PowerOff className="w-5 h-5 text-red-400" /> Shutdown
            </button>
            <button onClick={() => execute('pc-reboot')} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md p-3 text-sm flex flex-col items-center justify-center gap-2 transition-colors text-white font-bold">
              <RefreshCw className="w-5 h-5 text-orange-400" /> Reboot
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 lg:col-span-2 flex flex-col gap-4 border border-zinc-800">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <h2 className="text-base font-bold flex items-center gap-2 text-white"><Blocks className="w-5 h-5 text-indigo-400" /> Services</h2>
            <button onClick={fetchModules} className="text-indigo-400 hover:text-indigo-300"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {modules.map(mod => (
              <div key={mod.category} className={`flex flex-col gap-2 p-3 rounded-md border items-center text-center ${mod.online ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                <span className="font-bold text-sm text-white truncate w-full">{mod.category}</span>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs font-bold ${mod.online ? 'text-indigo-400' : 'text-slate-500'}`}>{mod.online ? 'Online' : 'Offline'}</span>
                </div>
                <div className="flex gap-1 w-full mt-2">
                  <button onClick={() => execute('module-toggle', { moduleName: mod.category, targetState: !mod.online })} className="flex-1 text-xs bg-zinc-950 hover:bg-zinc-900 px-2 py-1.5 rounded transition-colors border border-zinc-800 font-bold text-white">
                    {mod.online ? 'Stop' : 'Start'}
                  </button>
                  {mod.online && (
                    <button onClick={() => execute('module-restart', { moduleName: mod.category })} className="text-xs bg-zinc-950 hover:bg-zinc-900 px-2 py-1.5 rounded transition-colors border border-zinc-800 text-white">
                      R
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 lg:col-span-3 flex flex-col gap-4 border border-zinc-800">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <h2 className="text-base font-bold flex items-center gap-2 text-white"><Cpu className="w-5 h-5 text-indigo-400" /> Processes</h2>
            <button onClick={fetchPm2} className="text-indigo-400 hover:text-indigo-300"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pm2Procs.map(proc => {
              const isOnline = proc.pm2_env.status === 'online';
              return (
                <div key={proc.name} className={`flex flex-col gap-2 p-3 rounded-md border items-center text-center ${isOnline ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                  <span className="font-bold text-sm truncate w-full text-white" title={proc.name}>{proc.name}</span>
                  <div className="flex flex-col gap-0.5 w-full text-center">
                    <span className={`text-xs font-bold ${isOnline ? 'text-indigo-400' : 'text-slate-500'}`}>{proc.pm2_env.status.charAt(0).toUpperCase() + proc.pm2_env.status.slice(1)}</span>
                    <span className="text-xs text-slate-400">CPU: {proc.monit?.cpu || 0}% | Restarts: {proc.pm2_env.restart_time}</span>
                  </div>
                  <button onClick={() => execute('pm2-service-toggle', { processName: proc.name, targetPm2State: !isOnline })} className="mt-2 text-xs bg-zinc-950 hover:bg-zinc-900 px-3 py-1.5 rounded transition-colors w-full border border-zinc-800 font-bold text-white">
                    {isOnline ? 'Stop' : 'Start'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 lg:col-span-3 flex flex-col gap-4 border border-zinc-800">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <h2 className="text-base font-bold flex items-center gap-2 text-white"><Activity className="w-5 h-5 text-indigo-400" /> Hardware Status</h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 font-bold">
              Live
            </div>
          </div>
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
                <h3 className="text-slate-400 text-xs font-bold mb-2">CPU Usage</h3>
                <div className="text-2xl font-bold text-white mb-1">{stats.cpu.load}%</div>
                <div className="text-xs text-slate-400 truncate">{stats.cpu.manufacturer} {stats.cpu.brand}</div>
                <div className="mt-4 flex justify-between text-xs border-t border-zinc-800 pt-3">
                  <span className="text-slate-500">Temp:</span>
                  <span className="font-bold text-slate-300">{stats.cpu.temp}°C</span>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
                <h3 className="text-slate-400 text-xs font-bold mb-2">Memory</h3>
                <div className="text-2xl font-bold text-white mb-1">{Math.round((stats.memory.used / stats.memory.total)*100)}%</div>
                <div className="w-full bg-zinc-800 rounded-full h-1 mt-3 mb-2">
                  <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${(stats.memory.used / stats.memory.total)*100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs mt-4 border-t border-zinc-800 pt-3">
                  <span className="text-slate-500">Free:</span>
                  <span className="font-bold text-slate-300">{(stats.memory.free / 1e9).toFixed(2)} GB</span>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
                <h3 className="text-slate-400 text-xs font-bold mb-2">System</h3>
                <div className="text-sm font-bold text-white mb-1 truncate">{stats.os.distro}</div>
                <div className="text-xs text-slate-400 truncate">Uptime: {(stats.os.uptime / 3600).toFixed(1)}h</div>
                <div className="mt-4 flex justify-between text-xs border-t border-zinc-800 pt-3">
                  <span className="text-slate-500">IP:</span>
                  <span className="font-bold text-slate-300">{stats.network[0]?.ip4 || '--'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Loading stats...</p>
          )}
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 lg:col-span-3 border border-zinc-800">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-4">
            <h2 className="text-base font-bold flex items-center gap-2 text-white"><Terminal className="w-5 h-5 text-slate-400" /> Log</h2>
          </div>
          <pre ref={termRef} className="bg-zinc-950 border border-zinc-800 p-4 rounded-md font-mono text-xs overflow-x-auto overflow-y-auto text-slate-300 h-64 whitespace-pre-wrap">
            {terminal}
          </pre>
        </div>
      </div>
    </div>
  );
}
