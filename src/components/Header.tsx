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
    <header className="fixed top-0 inset-x-0 z-40 bg-[#0b1326]/85 backdrop-blur-xl border-b border-[#171f33] pt-safe transition-all">
      <div className="h-16 max-w-lg mx-auto px-4 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#10b981] to-[#4edea3] flex items-center justify-center shadow-sm shadow-[#10b981]/20">
            <span className="material-symbols-outlined text-[#003824] text-[20px] font-bold">
              balance
            </span>
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#dae2fd] font-headline">
              Equilibrium
            </span>
            <div className="text-[10px] text-[#4edea3] font-medium tracking-wide flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
              Live Sync
            </div>
          </div>
        </div>

        {/* Right Action Icons & Avatar */}
        <div className="flex items-center gap-2">
          {/* Quick Add Income / Credit Button */}
          <button
            onClick={onOpenIncomeModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171f33] hover:bg-[#222a3d] border border-[#2d3449] text-[#4edea3] text-xs font-semibold active:scale-95 transition-all"
            title="Add Cash or Salary Credit"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span className="hidden sm:inline">Add Funds</span>
          </button>

          {/* User Avatar Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-full bg-[#171f33] border border-[#2d3449] hover:border-[#4edea3] flex items-center justify-center overflow-hidden transition-all active:scale-95 focus:outline-none"
              aria-label="User profile menu"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[#4edea3] text-[20px]">
                  person
                </span>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-[#171f33] border border-[#2d3449] rounded-xl shadow-xl z-40 p-3 flex flex-col gap-2.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="pb-2 border-b border-[#2d3449]/70">
                    <p className="font-semibold text-sm text-[#dae2fd] truncate">
                      {user.displayName}
                    </p>
                    <p className="text-[11px] text-[#bbcabf] truncate">{user.email}</p>
                  </div>

                  {/* Pair Code Box */}
                  <div className="bg-[#0b1326] p-2.5 rounded-lg border border-[#2d3449] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#bbcabf] uppercase tracking-wider">
                        My Pair Code
                      </p>
                      <p className="font-mono font-bold text-sm text-[#4edea3] tracking-wider">
                        {user.pairCode || 'EQ-NONE'}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-2 py-1 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] border border-[#2d3449] text-[11px] font-medium flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {copiedCode ? 'check' : 'content_copy'}
                      </span>
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Partner status */}
                  <div className="text-[11px] text-[#bbcabf] flex items-center gap-1.5 px-1">
                    <span className="material-symbols-outlined text-[15px] text-[#adc6ff]">
                      {user.partnerUid ? 'link' : 'link_off'}
                    </span>
                    <span>
                      {user.partnerName
                        ? `Linked: ${user.partnerName}`
                        : 'No roommate linked yet'}
                    </span>
                  </div>

                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      await logoutUser();
                    }}
                    className="w-full mt-1 py-2 px-3 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/30 text-[#ffb4ab] border border-[#93000a]/40 font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Sign Out
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
