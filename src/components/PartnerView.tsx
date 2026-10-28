import React, { useState } from 'react';
import { UserProfile, SharedLedger, SharedTransaction } from '../types';
import { pairWithRoommate, unlinkPartner } from '../services/userService';

interface PartnerViewProps {
  user: UserProfile;
  ledger: SharedLedger | null;
  transactions: SharedTransaction[];
  onRefreshProfile?: () => void;
}

export const PartnerView: React.FC<PartnerViewProps> = ({
  user,
  ledger,
  transactions,
}) => {
  const [partnerInput, setPartnerInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const isLinked = Boolean(user.partnerUid);

  const handleCopyCode = () => {
    if (user.pairCode) {
      navigator.clipboard.writeText(user.pairCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    setIsLinking(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await pairWithRoommate(user, partnerInput.trim());
    setIsLinking(false);

    if (res.success) {
      setSuccessMsg(`Successfully linked with ${res.partnerProfile?.displayName || 'roommate'}!`);
      setPartnerInput('');
    } else {
      setErrorMsg(res.message || 'Failed to link roommate.');
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      await unlinkPartner(user);
      setShowUnlinkModal(false);
      setSuccessMsg('Roommate unlinked.');
    } catch {
      setErrorMsg('Failed to unlink roommate.');
    } finally {
      setIsUnlinking(false);
    }
  };

  // Calculate stats from transactions
  let totalFrontedByMe = 0;
  let totalFrontedByPartner = 0;
  let myNetBalance = 0;

  if (ledger) {
    const isUser1 =
      user.uid === ledger.user1 ||
      (user.email && ledger.user1 && ledger.user1.includes(user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')));
    myNetBalance = isUser1 ? ledger.netBalance : -ledger.netBalance;
  }

  transactions.forEach((tx) => {
    if (tx.isSettlement) return;
    const isMe = tx.paidBy === user.uid || (user.displayName && tx.paidByName === user.displayName);
    if (isMe) {
      totalFrontedByMe += tx.totalAmount;
    } else {
      totalFrontedByPartner += tx.totalAmount;
    }
  });

  const totalMutualSpend = totalFrontedByMe + totalFrontedByPartner;

  const formatINR = (val: number) => {
    return '₹' + Math.abs(Math.round(val)).toLocaleString('en-IN');
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-[#10b981]/20 border border-[#34d399]/40 text-[#34d399] text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-[#fb7185]/20 border border-[#fb7185]/40 text-[#fb7185] text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Unlinked View: Pairing Portal */}
      {!isLinked ? (
        <div className="flex flex-col gap-5">
          {/* Your Pair Code Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#a0aec0] uppercase tracking-wider font-headline">
                My Roommate Invite Code
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#34d399] text-[10px] font-bold border border-[#10b981]/30">
                Ready to Pair
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#070c18] rounded-2xl border border-white/10 shadow-inner">
              <div>
                <span className="text-[10px] text-[#a0aec0] block font-medium">Share this code with your roommate:</span>
                <span className="font-mono text-2xl font-extrabold text-[#34d399] tracking-widest mt-0.5 block">
                  {user.pairCode || 'EQ-NONE'}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-xl bg-[#1c263c] hover:bg-[#26334f] text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedCode ? 'check' : 'content_copy'}
                </span>
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-[#a0aec0] leading-relaxed">
              When your roommate enters your code, Equilibrium automatically creates a zero-sum bilateral ledger between both accounts.
            </p>
          </div>

          {/* Connect Roommate Form */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#adc6ff]/15 flex items-center justify-center text-[#adc6ff]">
                <span className="material-symbols-outlined text-[20px]">
                  person_add
                </span>
              </div>
              <h3 className="text-sm font-bold text-white font-headline">
                Enter Roommate's Code or Email
              </h3>
            </div>

            <form onSubmit={handlePair} className="flex flex-col gap-3.5">
              <div>
                <input
                  type="text"
                  placeholder="E.g. EQ-7B3F or roommate@gmail.com"
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-semibold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={isLinking || !partnerInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] font-bold">
                  link
                </span>
                <span>{isLinking ? 'Linking Roommate...' : 'Connect & Establish Ledger'}</span>
              </button>
            </form>
          </div>

          {/* How Zero-Sum Ledger Works Info */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-col gap-3">
            <span className="text-xs font-bold text-white font-headline">How Equilibrium Netting Works:</span>
            <div className="grid grid-cols-1 gap-2.5 text-xs text-[#a0aec0]">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#34d399] shrink-0 mt-0.5">
                  sync_alt
                </span>
                <span className="leading-snug">You and your roommate share a single synchronized ledger.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#34d399] shrink-0 mt-0.5">
                  balance
                </span>
                <span className="leading-snug">Expenses cancel out reciprocally — no manual calculations or third-party spreadsheets.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#34d399] shrink-0 mt-0.5">
                  bolt
                </span>
                <span className="leading-snug">All changes reflect in real-time across both phones with Cloud Firestore.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Linked Roommate Profile & Stats */
        <div className="flex flex-col gap-4">
          {/* Roommate Hero Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0566d9] to-[#adc6ff] flex items-center justify-center font-headline font-bold text-xl text-[#002e6a] shadow-lg shadow-[#0566d9]/25">
                  {user.partnerName ? user.partnerName.charAt(0).toUpperCase() : 'R'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-headline">
                    {user.partnerName || 'Roommate'}
                  </h3>
                  <p className="text-xs text-[#a0aec0]">{user.partnerEmail || 'Paired Roommate'}</p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#34d399] text-[10px] font-bold flex items-center gap-1.5 border border-[#10b981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span>
                Connected
              </div>
            </div>

            {/* Current Bilateral State Bar */}
            <div className="p-4 bg-[#070c18] rounded-2xl border border-white/10 flex items-center justify-between shadow-inner">
              <div>
                <span className="text-[10px] text-[#a0aec0] uppercase tracking-wider block font-semibold">
                  Net Ledger State
                </span>
                <span className="text-xs font-semibold text-white mt-0.5 block">
                  {myNetBalance > 0
                    ? `${user.partnerName} owes you`
                    : myNetBalance < 0
                    ? `You owe ${user.partnerName}`
                    : 'All Settled'}
                </span>
              </div>
              <span
                className={`text-lg font-extrabold font-headline tabular-nums ${
                  myNetBalance > 0
                    ? 'text-[#34d399]'
                    : myNetBalance < 0
                    ? 'text-[#fb7185]'
                    : 'text-white'
                }`}
              >
                {myNetBalance === 0 ? '₹0.00' : formatINR(myNetBalance)}
              </span>
            </div>
          </div>

          {/* Shared Statistics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg">
              <span className="text-[11px] text-[#a0aec0] block font-medium mb-1">
                Total Mutual Spend
              </span>
              <span className="text-base sm:text-xl font-bold font-headline text-white tabular-nums">
                {formatINR(totalMutualSpend)}
              </span>
              <span className="text-[10px] text-[#a0aec0] block mt-1">
                {transactions.filter((t) => !t.isSettlement).length} shared splits
              </span>
            </div>

            <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg">
              <span className="text-[11px] text-[#a0aec0] block font-medium mb-1">
                Fronted By You
              </span>
              <span className="text-base sm:text-xl font-bold font-headline text-[#34d399] tabular-nums">
                {formatINR(totalFrontedByMe)}
              </span>
              <span className="text-[10px] text-[#a0aec0] block mt-1">
                vs {formatINR(totalFrontedByPartner)} by {user.partnerName?.split(' ')[0] || 'Partner'}
              </span>
            </div>
          </div>

          {/* Roommate Options / Unlink Button */}
          <div className="pt-2 flex justify-between items-center px-1">
            <div className="text-xs text-[#a0aec0]">
              Pair Code: <strong className="text-white font-mono">{user.pairCode}</strong>
            </div>

            <button
              onClick={() => setShowUnlinkModal(true)}
              className="text-xs text-[#fb7185] hover:underline flex items-center gap-1 transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              <span>Unlink Roommate</span>
            </button>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

            <div className="flex items-center gap-2.5 text-[#fb7185]">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-base font-bold font-headline text-white">
                Unlink Roommate?
              </h3>
            </div>
            <p className="text-xs text-[#a0aec0] leading-relaxed">
              Are you sure you want to disconnect from {user.partnerName || 'your roommate'}? You can reconnect anytime by sharing your pair code again.
            </p>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="flex-1 py-3 bg-[#1c263c] hover:bg-[#26334f] text-white rounded-2xl text-xs font-semibold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="flex-1 py-3 bg-gradient-to-r from-[#e11d48] to-[#fb7185] text-white rounded-2xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-[#e11d48]/25"
              >
                {isUnlinking ? 'Unlinking...' : 'Confirm Unlink'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
