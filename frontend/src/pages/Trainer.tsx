import React, { useState } from 'react';
import axios from 'axios';
import { Search, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const SimpleCard = ({ pkmn }: { pkmn: any }) => {
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

export default function Trainer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [topTrainers, setTopTrainers] = useState<any[]>([]);

  React.useEffect(() => {
    fetchTopTrainers();
  }, []);

  const fetchTopTrainers = async () => {
    try {
      const res = await axios.get('/api/control-centre/top-trainers');
      if (res.data.success) {
        setTopTrainers(res.data.trainers);
      }
    } catch (err) {
      console.error('Failed to fetch top trainers', err);
    }
  };

  const searchProfile = async (e?: React.FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = directQuery || query;
    if (!searchQuery) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await axios.post('/api/control-centre/search-pokemon', { query: searchQuery });
      if (res.data.success) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Profile not found.');
      }
    } catch (err) {
      setError('Connection error.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans pb-20">
      <header className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Kitsune
          </Link>
          <div className="hidden sm:block text-xs font-bold text-slate-500 border-l border-zinc-800 pl-6">
            Trainer Index
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto mt-12 px-4">
        
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-6">
            Search Trainers
          </h1>
          
          <form onSubmit={searchProfile} className="max-w-xl mx-auto flex items-center bg-zinc-900 border border-zinc-800 rounded-md h-12 overflow-hidden focus-within:border-indigo-500">
            <Search className="w-5 h-5 text-slate-500 ml-4 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="bg-transparent border-none text-base text-white px-4 w-full h-full focus:outline-none placeholder-zinc-600"
              placeholder="Username or Phone Number..."
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 h-full transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {error && <p className="mt-6 inline-block text-sm text-red-400 bg-zinc-900 px-4 py-2 rounded border border-red-900">{error}</p>}
        </div>

        {!data && !loading && topTrainers.length > 0 && (
          <div className="w-full max-w-3xl mx-auto mb-20">
            <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-2">
              <h2 className="text-xl font-bold text-white">
                Leaderboard
              </h2>
              <div className="text-xs text-slate-500 font-bold">Top 10 Trainers</div>
            </div>
            
            <div className="grid gap-3">
              {topTrainers.map((trainer, idx) => (
                <button
                  key={trainer.lid}
                  onClick={() => {
                    setQuery(trainer.name);
                    searchProfile(undefined, trainer.lid);
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-lg flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center">
                      <span className="text-lg font-bold text-slate-500">
                        #{idx + 1}
                      </span>
                    </div>
                    
                    <div className="w-12 h-12 rounded bg-zinc-800 shrink-0 border border-zinc-700 overflow-hidden">
                      {trainer.profilePic ? (
                        <img src={trainer.profilePic} alt={trainer.name} className="w-full h-full object-cover" />
                      ) : (
                        <img src="/data/trainer.webp" alt="Trainer" className="w-full h-full object-cover" />
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-white font-bold text-base capitalize truncate max-w-[150px] sm:max-w-[200px]">{trainer.name}</h3>
                      <p className="text-xs text-slate-500">Level {trainer.prestigeLevel}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-white font-bold text-sm">{trainer.pokemonCount}</span>
                      <span className="text-xs text-slate-500">Cards</span>
                    </div>
                    <div className="flex flex-col items-end w-16 sm:w-20">
                      <span className="text-white font-bold text-sm">{trainer.pokecoins?.toLocaleString() || 0}</span>
                      <span className="text-xs text-slate-500">Coins</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {data && (
          <div className="w-full flex flex-col gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                <div className="p-8 flex items-center gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                    {data.profile.profilePic ? (
                      <img src={data.profile.profilePic} alt={data.profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <img src="/data/trainer.webp" alt="Trainer" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white capitalize">{data.profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">Level {data.profile.prestigeLevel || 0}</p>
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
                  <p className="text-slate-500 text-sm">No cards found in this collection.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {data.pokemons.map((pkmn: any) => (
                    <SimpleCard key={pkmn.name} pkmn={pkmn} />
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
