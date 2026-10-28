import React, { useState } from 'react';
import { UserProfile } from '../types';
import { logoutUser } from '../firebase';

interface HeaderProps {
  user: UserProfile;
  onOpenIncomeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenIncomeModal }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (user.pairCode) {
      navigator.clipboard.writeText(user.pairCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#070c18]/85 backdrop-blur-2xl border-b border-white/[0.06] pt-safe transition-all">
      <div className="h-16 max-w-lg mx-auto px-4 flex items-center justify-between">
        {/* Brand Logo & Live Sync Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#059669] via-[#10b981] to-[#34d399] flex items-center justify-center shadow-lg shadow-[#10b981]/25 ring-1 ring-white/20">
            <span className="material-symbols-outlined text-[#013421] text-[22px] font-bold">
              balance
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-white font-headline">
              Equilibrium
            </span>
            <div className="text-[10px] text-[#34d399] font-semibold tracking-wide flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]"></span>
              </span>
              <span>Zero-Sum Live</span>
            </div>
          </div>
        </div>

        {/* Right Action Icons & Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Quick Add Funds Button */}
          <button
            onClick={onOpenIncomeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-[#34d399] text-xs font-bold active:scale-95 transition-all shadow-sm"
            title="Credit Cash or Salary to Vault"
          >
            <span className="material-symbols-outlined text-[17px] text-[#34d399]">add_circle</span>
            <span className="font-headline tracking-tight">Deposit</span>
          </button>

          {/* User Avatar & Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-full bg-[#121a2d] border border-white/[0.12] hover:border-[#34d399] flex items-center justify-center overflow-hidden transition-all active:scale-95 focus:outline-none shadow-sm"
              aria-label="User profile menu"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold font-headline text-xs text-[#34d399]">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </button>

            {/* Profile Dropdown Sheet */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-[#0e1629]/95 border border-white/[0.12] rounded-2xl shadow-2xl z-40 p-4 flex flex-col gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-2xl">
                  {/* User details */}
                  <div className="pb-3 border-b border-white/[0.08]">
                    <p className="font-bold text-sm text-white font-headline truncate">
                      {user.displayName}
                    </p>
                    <p className="text-[11px] text-[#94a3b8] truncate mt-0.5">{user.email}</p>
                  </div>

                  {/* Roommate Invite Code Box */}
                  <div className="bg-[#070c18] p-3 rounded-xl border border-white/[0.08] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider">
                        My Roommate Code
                      </p>
                      <p className="font-mono font-extrabold text-sm text-[#34d399] tracking-wider mt-0.5">
                        {user.pairCode || 'EQ-NONE'}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.1] text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copiedCode ? 'check' : 'content_copy'}
                      </span>
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Partner link status pill */}
                  <div className="text-[11px] text-[#94a3b8] flex items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">
                      {user.partnerUid ? 'link' : 'link_off'}
                    </span>
                    <span className="truncate">
                      {user.partnerName
                        ? `Paired: ${user.partnerName}`
                        : 'No roommate paired'}
                    </span>
                  </div>

                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      await logoutUser();
                    }}
                    className="w-full mt-1 py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
