import { useState, useEffect } from 'react';
import axios from 'axios';
import { Coins, CheckCircle, XCircle, Loader, LogIn, User } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const SHOP_ITEMS = [
  {
    id: 'pokecoins-1m',
    name: '1,000,000 PokéCoins',
    desc: 'Purchase 1 million PokéCoins for your account.',
    amount_paise: 10000,
    display_price: '₹100',
    coins: 1_000_000,
  },
];

type PaymentStatus = 'idle' | 'loading' | 'success' | 'error';
interface StatusInfo {
  type: PaymentStatus;
  title?: string;
  message?: string;
}

export default function Shop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusInfo>({ type: 'idle' });

  const token    = localStorage.getItem('kitsune_user_token') || '';
  const userName = localStorage.getItem('kitsune_user_name') || '';
  const isLoggedIn = !!token;

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      setStatus({
        type: 'success',
        title: 'Payment successful',
        message: 'Your PokéCoins have been added to your account.'
      });
      setSearchParams(new URLSearchParams());
    }
  }, [searchParams, setSearchParams]);

  async function handleBuy(item: typeof SHOP_ITEMS[0]) {
    if (!isLoggedIn) {
      navigate(`/login?returnTo=/shop`);
      return;
    }

    setStatus({ type: 'loading' });

    try {
      const res = await axios.post('/api/payments/create-payment-link', {
        amount:      item.amount_paise,
        currency:    'INR',
        description: `${item.name} - ${item.display_price}`
      }, authHeaders());
      
      const data = res.data as { short_url: string };

      if (data.short_url) {
        window.location.href = data.short_url;
      } else {
        throw new Error('No payment link returned');
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('kitsune_user_token');
        navigate('/login?returnTo=/shop');
        return;
      }
      setStatus({
        type:    'error',
        title:   'Error',
        message: err.response?.data?.error || err.message || 'Could not create payment link.',
      });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 font-sans relative">

      <header className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 h-16 flex items-center justify-between px-6">
        <Link to="/" className="text-sm font-bold text-slate-400 hover:text-indigo-400 transition-colors">
          Home
        </Link>
        {isLoggedIn ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            <span>{userName || 'Trainer'}</span>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login?returnTo=/shop')}
            className="flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Log in
          </button>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Buy PokéCoins</h1>
          <p className="text-slate-400 text-sm">
            Purchase PokéCoins to use in the game.
          </p>

          {!isLoggedIn && (
            <div className="mt-4 inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3">
              <span className="text-slate-300 text-sm">
                You must be logged in to purchase items.
              </span>
              <button
                onClick={() => navigate('/login?returnTo=/shop')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-3 py-1.5 rounded transition-colors"
              >
                Log in
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SHOP_ITEMS.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col"
            >
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center">
                  <Coins className="w-8 h-8 text-indigo-400" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">{item.name}</h2>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>

              <div className="mt-auto">
                <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mb-4">
                  <span className="text-slate-400 text-sm">Price</span>
                  <span className="text-2xl font-bold text-white">{item.display_price}</span>
                </div>

                {isLoggedIn ? (
                  <button
                    onClick={() => handleBuy(item)}
                    disabled={status.type === 'loading'}
                    className="w-full py-3 rounded-md font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {status.type === 'loading' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" /> Redirecting...
                      </span>
                    ) : (
                      <>Buy Now - {item.display_price}</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/login?returnTo=/shop')}
                    className="w-full py-3 rounded-md font-bold text-sm text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Log in to buy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-zinc-800">
          <h2 className="text-lg font-bold text-white mb-4">Common questions</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-white font-bold text-sm mb-1">When do I receive the coins?</h3>
              <p className="text-slate-400 text-sm">Coins are added to your account immediately after payment is verified.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-1">What payment methods are supported?</h3>
              <p className="text-slate-400 text-sm">We accept UPI, cards, and net banking via Razorpay.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-1">Is this secure?</h3>
              <p className="text-slate-400 text-sm">Yes, payments are processed securely on Razorpay's website.</p>
            </div>
          </div>
        </div>
      </div>

      {}
      {status.type === 'success' || status.type === 'error' ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-sm w-full text-center">
            {status.type === 'success' ? (
              <CheckCircle className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="text-xl font-bold text-white mb-2">{status.title}</h2>
            <p className="text-slate-400 text-sm mb-6">{status.message}</p>
            <button
              onClick={() => setStatus({ type: 'idle' })}
              className="w-full py-2.5 rounded-md font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
