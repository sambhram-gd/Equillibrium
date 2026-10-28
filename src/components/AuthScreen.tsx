import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase';

interface AuthScreenProps {
  onGuestLogin?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onGuestLogin }) => {
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

  const handleGuestAccess = () => {
    const guestUser = {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: 'Equilibrium User',
      email: 'user@equilibrium.local',
    };
    try {
      localStorage.setItem('eq_guest_user', JSON.stringify(guestUser));
      window.dispatchEvent(new CustomEvent('eq_auth_changed'));
    } catch (e) {
      console.warn('Failed to save guest user', e);
    }
    if (onGuestLogin) {
      onGuestLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#070c18] text-[#dae2fd] flex flex-col justify-between p-6 max-w-md mx-auto pt-safe pb-safe selection:bg-[#34d399]/30">
      {/* Top Brand Logo */}
      <div className="pt-6 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-[#34d399]/20 rounded-3xl blur-xl"></div>
          <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#10b981] to-[#34d399] flex items-center justify-center shadow-xl shadow-[#10b981]/30">
            <span className="material-symbols-outlined text-[#013421] text-[36px] font-bold">
              balance
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight text-white">
          Equilibrium
        </h1>
        <p className="text-xs text-[#a0aec0] max-w-xs mt-2 leading-relaxed">
          High-performance personal budget management & bilateral zero-sum roommate expense tracking.
        </p>
      </div>

      {/* Feature Highlights Card */}
      <div className="my-6 glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#10b981]/15 text-[#34d399] flex items-center justify-center shrink-0 border border-[#10b981]/25">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-headline">
              Rapid Log Console
            </h3>
            <p className="text-[11px] text-[#a0aec0] mt-0.5 leading-snug">
              ₹2 incremental slider with odd-number fine tuning + tactile virtual numeric keypad.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#adc6ff]/15 text-[#adc6ff] flex items-center justify-center shrink-0 border border-[#adc6ff]/25">
            <span className="material-symbols-outlined text-[20px]">sync_alt</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-headline">
              Bilateral Zero-Sum Netting
            </h3>
            <p className="text-[11px] text-[#a0aec0] mt-0.5 leading-snug">
              Cumulative balance offsets roommate debts automatically to zero without manual spreadsheets.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#fbbf24]/15 text-[#fbbf24] flex items-center justify-center shrink-0 border border-[#fbbf24]/25">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-headline">
              Liquid Cash Vault
            </h3>
            <p className="text-[11px] text-[#a0aec0] mt-0.5 leading-snug">
              Live tracking of your present liquid bank balance and monthly burn-down rate.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Auth Action */}
      <div className="pb-4 flex flex-col gap-3">
        {error && (
          <div className="p-3.5 bg-[#fb7185]/20 border border-[#fb7185]/40 text-[#fb7185] text-xs font-semibold rounded-2xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span className="text-[11px]">{error}</span>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full py-4 bg-white hover:bg-[#dae2fd] text-[#070c18] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#070c18] border-t-transparent rounded-full animate-spin"></div>
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

        <button
          onClick={handleGuestAccess}
          type="button"
          className="w-full py-3.5 bg-[#121a2d] hover:bg-[#1c263c] border border-white/10 text-white rounded-2xl font-headline font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-[18px] text-[#34d399]">bolt</span>
          <span>Quick Access (Offline / Local Mode)</span>
        </button>

        <p className="text-[10px] text-center text-[#a0aec0] mt-1">
          Zero passwords • Instant auto-saving in browser & Cloud Firestore
        </p>
      </div>
    </div>
  );
};
