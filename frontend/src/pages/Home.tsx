import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Search as SearchIcon, List, Grid, ChevronDown, X, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const SimpleCard = ({ pkmn, onClick }: { pkmn: any, onClick: () => void }) => {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer flex flex-col"
    >
      <div className="w-full aspect-[63/88] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 relative transition-colors hover:border-indigo-500">
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
          {pkmn.types?.slice(0, 2).map((t: string) => (
            <span key={t} className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-950 text-white border border-zinc-800">{t}</span>
          ))}
        </div>

        {pkmn.images?.large ? (
          <img 
            src={pkmn.images.large} 
            alt={pkmn.name} 
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class="text-4xl opacity-20 absolute inset-0 flex items-center justify-center">?</span>'; }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <span className="text-4xl text-zinc-700">?</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-col">
        <span className="text-[10px] font-mono text-slate-500">#{pkmn.id}</span>
        <span className="text-sm font-bold text-white truncate w-full">{pkmn.name}</span>
      </div>
    </div>
  );
};

export default function Home() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'code'>('details');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState('All');
  const navigate = useNavigate();

  const fetchCards = useCallback(async (pageNum: number, isNewSearch: boolean = false) => {
    if (isNewSearch) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = '';
      const filters = [];
      if (search) filters.push(`name:"*${search}*"`);
      if (typeFilter !== 'All') filters.push(`types:"${typeFilter}"`);
      
      if (filters.length > 0) {
        query = filters.join(' ');
      }

      const res = await axios.get('https://api.pokemontcg.io/v2/cards', {
        params: {
          page: pageNum,
          pageSize: 48,
          q: query || undefined,
          orderBy: '-set.releaseDate'
        }
      });

      if (isNewSearch) {
        setCards(res.data.data);
      } else {
        setCards(prev => [...prev, ...res.data.data]);
      }
      
      setTotalCount(res.data.totalCount);
      setHasMore(pageNum * 48 < res.data.totalCount);
    } catch (err) {
      console.error('Failed to fetch TCG Data', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    setPage(1);
    const timeoutId = setTimeout(() => {
      fetchCards(1, true);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search, typeFilter, fetchCards]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCards(nextPage, false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
  };

  const types = ['All', 'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'];

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans flex flex-col">
      <header className="sticky top-0 z-40 bg-zinc-950 border-b border-zinc-800 h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6 flex-1">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Kitsune
          </Link>
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl items-center bg-zinc-900 border border-zinc-800 rounded-md h-9 overflow-hidden focus-within:border-indigo-500 transition-colors">
            <div className="flex items-center px-3 border-r border-zinc-800 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              TCG <ChevronDown className="w-3 h-3 ml-1" />
            </div>
            <SearchIcon className="w-4 h-4 text-slate-500 ml-3" />
            <input 
              type="text" 
              placeholder="Search database..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none text-sm text-white px-3 w-full h-full focus:outline-none placeholder-zinc-600"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 h-full transition-colors">
              Search
            </button>
          </form>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm font-bold">
          <Link to="/trainer" className="hidden sm:block text-slate-400 hover:text-white transition-colors">Trainer Dex</Link>
          <Link to="/shop" className="hidden sm:block text-slate-400 hover:text-white transition-colors">Shop</Link>
          <Link to="/control-centre" className="hidden md:block text-slate-400 hover:text-white transition-colors">Dashboard</Link>
          <button onClick={() => navigate('/login')} className="text-white hover:text-indigo-400 transition-colors">
            Log in
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="hidden lg:flex flex-col w-56 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide px-2">Types</h3>
          <div className="space-y-1">
            {types.map(t => (
              <button 
                key={t} 
                onClick={() => setTypeFilter(t)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${typeFilter === t ? 'bg-indigo-900/30 text-indigo-400' : 'text-slate-400 hover:bg-zinc-900 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-950">
          <div className="md:hidden mb-6">
            <form onSubmit={handleSearchSubmit} className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md h-10 overflow-hidden focus-within:border-indigo-500">
              <SearchIcon className="w-4 h-4 text-slate-500 ml-3" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none text-sm text-white px-3 w-full h-full focus:outline-none placeholder-zinc-600"
              />
            </form>
          </div>
          
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Pokémon TCG Database</h2>
              <p className="text-slate-400 text-sm mt-1">{totalCount.toLocaleString()} cards found</p>
            </div>
            
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-md p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Grid className="w-3.5 h-3.5"/> Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <List className="w-3.5 h-3.5"/> List
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64 text-indigo-500">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {cards.map(pkmn => (
                    <SimpleCard key={pkmn.id} pkmn={pkmn} onClick={() => setSelected(pkmn)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {cards.map(pkmn => (
                    <div 
                      key={pkmn.id} 
                      onClick={() => setSelected(pkmn)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-4 cursor-pointer hover:border-indigo-500 transition-colors"
                    >
                      <div className="w-12 h-16 bg-zinc-950 rounded border border-zinc-800 overflow-hidden flex-shrink-0">
                        {pkmn.images?.small ? <img src={pkmn.images.small} alt={pkmn.name} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700">?</div>}
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-500">#{pkmn.id}</span>
                        <h3 className="text-base font-bold text-white">{pkmn.name}</h3>
                        <div className="flex gap-2 mt-1">
                          {pkmn.types?.map((t: string) => (
                            <span key={t} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-slate-300">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end text-sm text-slate-400">
                        <span>{pkmn.hp ? `HP ${pkmn.hp}` : ''}</span>
                        <span>{pkmn.rarity || 'Unknown'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {hasMore && (
                <div className="flex justify-center mt-10 mb-8">
                  <button 
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-sm font-bold px-6 py-2 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingMore ? <Loader className="w-4 h-4 animate-spin" /> : null}
                    {loadingMore ? 'Loading' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-center p-4">
          <div className="max-w-5xl w-full max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col md:flex-row overflow-hidden relative shadow-2xl">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white bg-zinc-900 p-1.5 rounded-md border border-zinc-800">
              <X className="w-5 h-5" />
            </button>

            <div className="w-full md:w-5/12 h-[40vh] md:h-auto bg-zinc-900 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-zinc-800">
              {selected.images?.large ? (
                <img src={selected.images.large} alt={selected.name} className="max-h-full max-w-full object-contain rounded-md" />
              ) : (
                <div className="text-6xl text-zinc-700">?</div>
              )}
            </div>

            <div className="w-full md:w-7/12 flex flex-col max-h-[50vh] md:max-h-none overflow-hidden">
              <div className="flex border-b border-zinc-800 bg-zinc-950">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'details' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}
                >
                  Details
                </button>
                <button 
                  onClick={() => setActiveTab('code')}
                  className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'code' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-white'}`}
                >
                  Data
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm bg-zinc-950">
                {activeTab === 'code' ? (
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Set</h3>
                      <p className="text-lg font-bold text-white">{selected.set?.name} ({selected.set?.id})</p>
                      <p className="text-slate-400 mt-1">Released: {selected.set?.releaseDate} • Series: {selected.set?.series}</p>
                    </div>
                    
                    {selected.attacks && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Attacks</h3>
                        <div className="flex flex-col gap-3">
                          {selected.attacks.map((atk: any, idx: number) => (
                            <div key={idx} className="bg-zinc-900 p-4 rounded-md border border-zinc-800">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-white">{atk.name}</span>
                                {atk.damage && <span className="font-bold text-slate-400">{atk.damage} DMG</span>}
                              </div>
                              {atk.text && <p className="text-sm text-slate-400">{atk.text}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selected.rules && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Rules</h3>
                        <div className="flex flex-col gap-2">
                          {selected.rules.map((rule: string, idx: number) => (
                            <div key={idx} className="bg-zinc-900 p-3 rounded-md border border-zinc-800">
                              <p className="text-sm text-slate-300">{rule}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="bg-zinc-900 p-4 rounded-md border border-zinc-800">
                        <p className="text-xs font-bold text-slate-500 mb-1">Rarity</p>
                        <p className="font-bold text-white">{selected.rarity || 'Unknown'}</p>
                      </div>
                      <div className="bg-zinc-900 p-4 rounded-md border border-zinc-800">
                        <p className="text-xs font-bold text-slate-500 mb-1">Supertype</p>
                        <p className="font-bold text-white">{selected.supertype}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
