import React, { useState, useEffect } from 'react';
import { Smartphone, Lock, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function UserLogin() {
  const [number, setNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/play';

  useEffect(() => {
    if (localStorage.getItem('kitsune_user_token')) {
      navigate(returnTo, { replace: true });
    }
  }, [navigate, returnTo]);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (number.length < 10) {
      setError('Please enter a valid 10-digit WhatsApp number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/user/request-otp', { number });
      if (res.data.success) {
        setStep(2);
      } else {
        setError(res.data.error || 'Failed to send OTP. Make sure the bot is online.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/user/verify-otp', { number, otp });
      if (res.data.success) {
        localStorage.setItem('kitsune_user_lid', res.data.lid);
        localStorage.setItem('kitsune_user_name', res.data.name);
        localStorage.setItem('kitsune_user_token', res.data.token);
        navigate(returnTo, { replace: true });
      } else {
        setError(res.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans relative flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6 z-50">
        <Link to="/" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-full max-w-md text-center relative z-10">
        <div className="mb-8 flex justify-center">
          <img src="/data/kitsune.webp?v=2" alt="Kitsune" className="h-16 w-auto object-contain" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2 text-white">Log in</h1>
        <p className="text-slate-400 mb-8 text-sm">Access your dashboard</p>
        
        {step === 1 ? (
          <form onSubmit={requestOtp} className="space-y-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Smartphone className="w-5 h-5 text-slate-500" />
                <span className="ml-2 text-slate-400 font-mono text-sm">+91</span>
              </div>
              <input 
                type="text" 
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-20 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-mono" 
                placeholder="Phone number" 
                required 
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || number.length < 10}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Get OTP on WhatsApp'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-slate-500" />
              </div>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-mono text-center tracking-widest text-lg" 
                placeholder="000000" 
                required 
              />
            </div>
            <p className="text-xs text-slate-400">We sent a 6-digit code to your WhatsApp.</p>
            <button 
              type="submit" 
              disabled={loading || otp.length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying...' : 'Log in'} <ShieldCheck className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-indigo-400 hover:text-indigo-300 mt-4 block mx-auto"
            >
              Use a different number
            </button>
          </form>
        )}

        {error && (
          <div className="mt-6 p-3 bg-red-900/30 border border-red-800 rounded-md text-left">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
