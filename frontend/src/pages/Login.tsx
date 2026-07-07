import React, { useState } from 'react';
import { ShieldAlert, Unlock, Sword } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Login({ setAuth }: { setAuth: (val: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/control-centre/execute', {
        password,
        action: 'verify'
      });
      if (res.data.success) {
        setAuth(password);
        navigate('/control-centre/dashboard');
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950">
      <div className="bg-zinc-900 rounded-lg p-10 w-full max-w-md text-center border border-zinc-800">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-zinc-950 rounded-full border border-zinc-800">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2 text-white">Admin Login</h1>
        <p className="text-slate-400 mb-8 text-sm">Enter administrator password</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all" 
              placeholder="••••••••" 
              required 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" /> Log in
          </button>
        </form>
        {error && <p className="text-red-400 mt-5 text-sm">Invalid password.</p>}

        <div className="mt-8 pt-6 border-t border-zinc-800">
          <Link to="/" className="text-slate-400 hover:text-indigo-400 text-sm flex items-center justify-center gap-2 transition-colors font-bold">
            <Sword className="w-4 h-4" /> Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
