import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Server, LogOut, Sword } from 'lucide-react';

export default function Layout({ setAuth }: { setAuth: (val: string) => void }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setAuth('');
    navigate('/control-centre');
  };

  return (
    <div className="min-h-screen flex flex-col gap-6 p-4 max-w-6xl mx-auto bg-zinc-950 font-sans">
      <div className="bg-zinc-900 rounded-lg p-6 flex justify-between items-center border border-zinc-800">
        <div className="flex items-center gap-4">
          <Server className="w-8 h-8 text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Kitsune Control Centre</h1>
            <p className="text-slate-400 text-sm">Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-white font-bold flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition-colors">
            <Sword className="w-4 h-4" /> Home
          </Link>
          <button 
            onClick={handleLogout} 
            className="text-white font-bold flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </div>

      <Outlet />
    </div>
  );
}
