import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase';

export const AuthScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      console.error('Google Sign-in failed', err);
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please retry.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Top Brand Logo */}
      <div className="pt-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#10b981] to-[#4edea3] flex items-center justify-center shadow-xl shadow-[#10b981]/25 mb-4">
          <span className="material-symbols-outlined text-[#003824] text-[36px] font-bold">
            balance
          </span>
        </div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-[#dae2fd]">
          Equilibrium
        </h1>
        <p className="text-xs text-[#bbcabf] max-w-xs mt-2 leading-relaxed">
          High-performance personal budget management & bilateral zero-sum roommate expense tracking.
        </p>
      </div>

      {/* Feature Highlights Card */}
      <div className="my-8 bg-[#171f33] rounded-3xl p-5 border border-[#2d3449] shadow-lg flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4edea3]/15 text-[#4edea3] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#dae2fd] font-headline">
              Rapid Log Console
            </h3>
            <p className="text-[11px] text-[#bbcabf] mt-0.5 leading-snug">
              ₹2 incremental slider with odd-number fine tuning + tactile virtual numeric keypad.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#adc6ff]/15 text-[#adc6ff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">sync_alt</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#dae2fd] font-headline">
              Bilateral Zero-Sum Netting
            </h3>
            <p className="text-[11px] text-[#bbcabf] mt-0.5 leading-snug">
              Cumulative balance offsets roommate debts automatically to zero without manual debt spreadsheets.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ffb95f]/15 text-[#ffb95f] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#dae2fd] font-headline">
              Liquid Cash Vault
            </h3>
            <p className="text-[11px] text-[#bbcabf] mt-0.5 leading-snug">
              Live tracking of your present liquid bank balance and monthly burn-down rate.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Auth Action */}
      <div className="pb-6 flex flex-col gap-3">
        {error && (
          <div className="p-3 bg-[#93000a]/20 border border-[#ffb4ab] text-[#ffb4ab] text-xs rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span className="text-[11px]">{error}</span>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full py-4 bg-[#dae2fd] hover:bg-white text-[#0b1326] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#0b1326] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
        </button>

        <p className="text-[10px] text-center text-[#bbcabf]">
          Zero passwords • Direct Google Sign-In with Cloud Firestore
        </p>
      </div>
    </div>
  );
};
