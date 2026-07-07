import { useState, useEffect } from 'react';
import axios from 'axios';
import { LogOut, ShoppingCart, Sparkles, ChevronUp, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const SimpleCard = ({ pkmn, onLevelUp }: { pkmn: any, onLevelUp: (name: string, item: string) => void }) => {
  return (
    <div className="group flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden transition-colors hover:border-indigo-500 relative">
      <div className="w-full aspect-[63/88] relative">
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
          {pkmn.isMythical && <span className="bg-indigo-900 text-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-800">MYTHICAL</span>}
          {pkmn.isLegendary && <span className="bg-yellow-900 text-yellow-100 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-800">LEGENDARY</span>}
        </div>

        <div className="absolute top-2 right-2 z-20">
          <span className="bg-zinc-800 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-md border border-zinc-700">
            x{pkmn.count}
          </span>
        </div>

        <img 
          src={pkmn.cardImage?.startsWith('http') || pkmn.cardImage?.startsWith('./data') || pkmn.cardImage?.startsWith('/data') ? pkmn.cardImage.replace('./data', '/data') : `/data/${pkmn.name.toLowerCase().replace(/ /g, '_')}.png`} 
          alt={pkmn.name} 
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { 
            e.currentTarget.style.display = 'none'; 
            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-700 text-4xl">?</div>'; 
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-3 bg-zinc-900/95 border-t border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onLevelUp(pkmn.name, 'Level Orb'); }}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-white py-1.5 rounded transition-colors flex items-center justify-center gap-1"
            >
              <ChevronUp className="w-3 h-3" /> Orb
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onLevelUp(pkmn.name, 'Enchanted Stardust'); }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold text-white py-1.5 rounded transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Dust
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-3 border-t border-zinc-800 bg-zinc-900">
        <h3 className="text-sm font-bold text-white truncate capitalize">{pkmn.name}</h3>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] font-bold text-slate-500">LEVEL</span>
          <span className="text-[10px] font-bold text-indigo-400">{pkmn.bestLevel}</span>
        </div>
      </div>
    </div>
  );
};

export default function WebGame() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const userAuth = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('kitsune_user_token') || ''}` }
  });

  const fetchProfile = async () => {
    const token = localStorage.getItem('kitsune_user_token');
    if (!token) return;
    try {
      const profile = await axios.get('/api/user/profile', userAuth());
      const res = await axios.post('/api/control-centre/search-pokemon', { query: profile.data.lid });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const token = localStorage.getItem('kitsune_user_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const init = async () => {
      try {
        const profile = await axios.get('/api/user/profile', userAuth());
        const res = await axios.post('/api/control-centre/search-pokemon', { query: profile.data.lid });
        if (res.data.success) {
          setData(res.data);
        } else {
          setError(res.data.error || 'Profile not found.');
        }
      } catch (err: any) {
        const status = err.response?.status;
        if (!status || status === 401 || status === 403) {
          localStorage.removeItem('kitsune_user_token');
          localStorage.removeItem('kitsune_user_lid');
          localStorage.removeItem('kitsune_user_name');
          setLoading(false);
          navigate('/login');
          return;
        }
        setError('Server error. Please try again.');
      }
      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('kitsune_user_lid');
    localStorage.removeItem('kitsune_user_name');
    localStorage.removeItem('kitsune_user_token');
    navigate('/');
  };

  const handleBuy = async (itemKey: string, qty: number = 1) => {
    const token = localStorage.getItem('kitsune_user_token');
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await axios.post('/api/user/buy-item', { itemKey, qty }, userAuth());
      if (res.data.success) {
        alert(`Bought ${qty} ${res.data.item} for ${res.data.spent.toLocaleString()} coins.`);
        fetchProfile();
      } else {
        alert(`Could not buy: ${res.data.reason}`);
      }
    } catch (e) {
      alert('Network error.');
    }
    setActionLoading(false);
  };

  const handleLevelUp = async (pokemonName: string, itemName: string) => {
    const token = localStorage.getItem('kitsune_user_token');
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await axios.post('/api/user/use-item', { itemName, pokemonName }, userAuth());
      if (res.data.success) {
        alert(`${pokemonName} leveled up to ${res.data.newLevel}.`);
        fetchProfile();
      } else {
        if (res.data.reason === 'failed') {
          alert(`Item failed to work on ${pokemonName}.`);
        } else {
          alert(`Error: ${res.data.reason}`);
        }
      }
    } catch (e) {
      alert('Network error.');
    }
    setActionLoading(false);
  };

  const handleGacha = async () => {
    const token = localStorage.getItem('kitsune_user_token');
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await axios.post('/api/user/gacha-wish', { count: 1 }, userAuth());
      if (res.data.success) {
        const pull = res.data.results[0];
        if (pull.rarity === 5 || pull.rarity === 4) {
          alert(`You drew a rank ${pull.rarity} ${pull.pokemonName}.`);
        } else {
          alert(`You received ${pull.quantity} ${pull.item}.`);
        }
        fetchProfile();
      } else {
        alert(`Draw failed: ${res.data.reason}`);
      }
    } catch (e) {
      alert('Network error.');
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-indigo-500">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans pb-20">
      <header className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Kitsune
          </Link>
          <div className="hidden sm:block text-xs font-bold text-slate-500 border-l border-zinc-800 pl-6">
            Dashboard
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <div className="w-full max-w-6xl mx-auto mt-8 px-4">
        
        {error ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center max-w-md mx-auto mt-20">
            <p className="text-red-400 mb-6">{error}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => { setError(''); setLoading(true); window.location.reload(); }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleLogout}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded transition-colors"
              >
                Return to Login
              </button>
            </div>
          </div>
        ) : data && (
          <div className="w-full flex flex-col gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                <div className="p-8 flex items-center gap-6">
                  <div className="w-16 h-16 rounded bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                    {data.profile.profilePic ? (
                      <img src={data.profile.profilePic} alt={data.profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <img src="/data/trainer.webp" alt="Trainer" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white capitalize">{data.profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">ID: {data.profile.lid?.split('@')[0]}</p>
                    <p className="text-xs text-slate-500 mt-1">Level: <span className="text-white font-bold">{data.profile.prestigeLevel || 0}</span></p>
                  </div>
                </div>
                
                <div className="md:col-span-2 grid grid-cols-3 divide-x divide-zinc-800">
                  <div className="p-6 flex flex-col justify-center items-center text-center">
                    <p className="text-2xl font-bold text-white font-mono">{data.profile.pokecoins?.toLocaleString() || 0}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Coins</p>
                  </div>
                  <div className="p-6 flex flex-col justify-center items-center text-center">
                    <p className="text-2xl font-bold text-white font-mono">{data.profile.pokeballs || 0}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Balls</p>
                  </div>
                  <div className="p-6 flex flex-col justify-center items-center text-center">
                    <p className="text-2xl font-bold text-white font-mono">{data.profile.radiantCrystals || 0}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Crystals</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <ShoppingCart className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white">Store</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Level Orb</h4>
                      <p className="text-xs text-slate-500 mt-0.5">800 Coins</p>
                    </div>
                    <button disabled={actionLoading} onClick={() => handleBuy('level orb')} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors">Buy</button>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Enchanted Stardust</h4>
                      <p className="text-xs text-slate-500 mt-0.5">10,000 Coins</p>
                    </div>
                    <button disabled={actionLoading} onClick={() => handleBuy('enchanted stardust')} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors">Buy</button>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-3 rounded border border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Wishing Compass</h4>
                      <p className="text-xs text-slate-500 mt-0.5">160 Crystals</p>
                    </div>
                    <button disabled={actionLoading} onClick={() => handleBuy('wishing compass')} className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors">Buy</button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white">Card Draw</h3>
                </div>
                
                <div className="bg-zinc-950 p-4 rounded border border-zinc-800 h-[calc(100%-3rem)] flex flex-col justify-between">
                  <p className="text-sm text-slate-400 mb-4">
                    Use Wishing Compasses to draw max level cards.
                  </p>
                  <button disabled={actionLoading} onClick={() => handleGacha()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded transition-colors">
                    Draw 1 Card
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-6 border-b border-zinc-800 pb-4">
                <h3 className="text-lg font-bold text-white">
                  Collection
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {data.pokemons.length} cards
                </span>
              </div>
              
              {data.pokemons.length === 0 ? (
                <div className="text-center py-16 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="text-slate-500 text-sm">Your collection is empty.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {data.pokemons.map((pkmn: any) => (
                    <SimpleCard key={pkmn.name} pkmn={pkmn} onLevelUp={handleLevelUp} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
