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
        <div className="p-3 bg-[#10b981]/20 border border-[#4edea3] text-[#4edea3] text-xs font-semibold rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-[#93000a]/20 border border-[#ffb4ab] text-[#ffb4ab] text-xs font-semibold rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Unlinked View: Pairing Portal */}
      {!isLinked ? (
        <div className="flex flex-col gap-5">
          {/* Your Pair Code Card */}
          <div className="bg-[#171f33] rounded-2xl p-5 border border-[#2d3449] shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#bbcabf] uppercase tracking-wider">
                My Roommate Invite Code
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#4edea3]/15 text-[#4edea3] text-[10px] font-bold">
                Ready to Pair
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#0b1326] rounded-xl border border-[#2d3449]">
              <div>
                <span className="text-[10px] text-[#bbcabf] block">Share this code with your roommate:</span>
                <span className="font-mono text-2xl font-extrabold text-[#4edea3] tracking-wider">
                  {user.pairCode || 'EQ-NONE'}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3.5 py-2 rounded-xl bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] border border-[#3c4a42] text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedCode ? 'check' : 'content_copy'}
                </span>
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <p className="text-xs text-[#bbcabf] leading-relaxed">
              When your roommate enters your code, Equilibrium automatically creates a zero-sum ledger between your accounts.
            </p>
          </div>

          {/* Connect Roommate Form */}
          <div className="bg-[#171f33] rounded-2xl p-5 border border-[#2d3449] shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#adc6ff]/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#adc6ff] text-[18px]">
                  person_add
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#dae2fd] font-headline">
                Enter Roommate's Code or Email
              </h3>
            </div>

            <form onSubmit={handlePair} className="flex flex-col gap-3">
              <div>
                <input
                  type="text"
                  placeholder="E.g. EQ-7B3F or roommate@gmail.com"
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0b1326] border border-[#2d3449] rounded-xl text-sm font-semibold text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={isLinking || !partnerInput.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] font-bold">
                  link
                </span>
                <span>{isLinking ? 'Linking Roommate...' : 'Connect & Establish Ledger'}</span>
              </button>
            </form>
          </div>

          {/* How Zero-Sum Ledger Works Info */}
          <div className="bg-[#171f33]/60 rounded-2xl p-4 border border-[#2d3449]/50 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-[#dae2fd]">How Equilibrium Netting Works:</span>
            <div className="grid grid-cols-1 gap-2 text-xs text-[#bbcabf]">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3] shrink-0 mt-0.5">
                  sync_alt
                </span>
                <span>You and your roommate share a single synchronized ledger.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3] shrink-0 mt-0.5">
                  balance
                </span>
                <span>Expenses cancel out reciprocally — no manual calculations or third-party spreadsheets.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3] shrink-0 mt-0.5">
                  bolt
                </span>
                <span>All changes reflect in real-time across both phones with Cloud Firestore.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Linked Roommate Profile & Stats */
        <div className="flex flex-col gap-4">
          {/* Roommate Hero Card */}
          <div className="bg-gradient-to-br from-[#171f33] to-[#131b2e] rounded-2xl p-5 border border-[#2d3449] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0566d9] to-[#adc6ff] flex items-center justify-center font-headline font-bold text-lg text-[#002e6a] shadow-md shadow-[#0566d9]/20">
                  {user.partnerName ? user.partnerName.charAt(0).toUpperCase() : 'R'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#dae2fd] font-headline">
                    {user.partnerName || 'Roommate'}
                  </h3>
                  <p className="text-xs text-[#bbcabf]">{user.partnerEmail || 'Paired Roommate'}</p>
                </div>
              </div>

              <div className="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[10px] font-bold flex items-center gap-1 border border-[#10b981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                Connected
              </div>
            </div>

            {/* Current Bilateral State Bar */}
            <div className="p-3 bg-[#0b1326] rounded-xl border border-[#2d3449] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#bbcabf] uppercase tracking-wider block">
                  Net Ledger State
                </span>
                <span className="text-xs font-semibold text-[#dae2fd]">
                  {myNetBalance > 0
                    ? `${user.partnerName} owes you`
                    : myNetBalance < 0
                    ? `You owe ${user.partnerName}`
                    : 'All Settled'}
                </span>
              </div>
              <span
                className={`text-base font-extrabold font-headline tabular-nums ${
                  myNetBalance > 0
                    ? 'text-[#4edea3]'
                    : myNetBalance < 0
                    ? 'text-[#ffb4ab]'
                    : 'text-[#dae2fd]'
                }`}
              >
                {myNetBalance === 0 ? '₹0.00' : formatINR(myNetBalance)}
              </span>
            </div>
          </div>

          {/* Shared Statistics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#171f33] rounded-2xl p-4 border border-[#2d3449]">
              <span className="text-[11px] text-[#bbcabf] block mb-1">
                Total Mutual Spend
              </span>
              <span className="text-base sm:text-lg font-bold font-headline text-[#dae2fd] tabular-nums">
                {formatINR(totalMutualSpend)}
              </span>
              <span className="text-[10px] text-[#bbcabf] block mt-1">
                {transactions.filter((t) => !t.isSettlement).length} shared splits
              </span>
            </div>

            <div className="bg-[#171f33] rounded-2xl p-4 border border-[#2d3449]">
              <span className="text-[11px] text-[#bbcabf] block mb-1">
                Fronted By You
              </span>
              <span className="text-base sm:text-lg font-bold font-headline text-[#4edea3] tabular-nums">
                {formatINR(totalFrontedByMe)}
              </span>
              <span className="text-[10px] text-[#bbcabf] block mt-1">
                vs {formatINR(totalFrontedByPartner)} by {user.partnerName?.split(' ')[0] || 'Partner'}
              </span>
            </div>
          </div>

          {/* Roommate Options / Unlink Button */}
          <div className="pt-2 flex justify-between items-center px-1">
            <div className="text-xs text-[#bbcabf]">
              Pair Code: <strong className="text-[#dae2fd] font-mono">{user.pairCode}</strong>
            </div>

            <button
              onClick={() => setShowUnlinkModal(true)}
              className="text-xs text-[#ffb4ab] hover:underline flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">link_off</span>
              <span>Unlink Roommate</span>
            </button>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#171f33] rounded-2xl border border-[#2d3449] p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-sm font-bold font-headline text-[#dae2fd]">
                Unlink Roommate?
              </h3>
            </div>
            <p className="text-xs text-[#bbcabf] leading-relaxed">
              Are you sure you want to disconnect from {user.partnerName || 'your roommate'}? You can reconnect anytime by sharing your pair code again.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="flex-1 py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="flex-1 py-2.5 bg-[#93000a] hover:bg-[#b00020] text-white rounded-xl text-xs font-bold"
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
