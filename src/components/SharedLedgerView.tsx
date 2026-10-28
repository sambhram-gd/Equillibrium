import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile, SharedLedger, SharedTransaction } from '../types';
import { addSharedTransaction, settleUpLedger, getLedgerId } from '../services/sharedLedgerService';

interface SharedLedgerViewProps {
  user: UserProfile;
  ledger: SharedLedger | null;
  transactions: SharedTransaction[];
  onNavigateToPartner: () => void;
}

const SHARED_CATEGORIES = [
  { name: 'Groceries', icon: 'shopping_cart' },
  { name: 'Rent', icon: 'home' },
  { name: 'Utilities', icon: 'bolt' },
  { name: 'Dining', icon: 'restaurant' },
  { name: 'Wifi/Bills', icon: 'wifi' },
  { name: 'House Supplies', icon: 'cleaning_services' },
  { name: 'Travel/Cab', icon: 'local_taxi' },
  { name: 'Other', icon: 'category' },
];

export const SharedLedgerView: React.FC<SharedLedgerViewProps> = ({
  user,
  ledger,
  transactions,
  onNavigateToPartner,
}) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Form State for Shared Expense
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayStr());
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage other person pays
  const [customSplit, setCustomSplit] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Groceries');
  const [description, setDescription] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const partnerName = user.partnerName || 'Roommate';

  // Calculate net balance from current user's perspective
  // user1 is lower UID, user2 is higher UID
  // netBalance > 0: user1 is owed; netBalance < 0: user2 is owed
  let userNetBalance = 0;
  if (ledger) {
    const isUser1 =
      user.uid === ledger.user1 ||
      (user.email && ledger.user1 && ledger.user1.includes(user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')));
    userNetBalance = isUser1 ? ledger.netBalance : -ledger.netBalance;
  }

  const formatINR = (val: number) => {
    return '₹' + Math.abs(Math.round(val)).toLocaleString('en-IN');
  };

  // Compute other person's owe amount
  const parsedTotal = parseFloat(totalAmount) || 0;
  let otherOweAmount = 0;
  if (isCustomMode) {
    otherOweAmount = parseFloat(customSplit) || 0;
  } else {
    otherOweAmount = Math.round((parsedTotal * splitRatio) / 100);
  }
  const myShareAmount = Math.max(0, parsedTotal - otherOweAmount);

  const handleOpenAddModal = () => {
    setPayer('me');
    setTotalAmount('');
    setExpenseDate(getTodayStr());
    setSplitRatio(50);
    setIsCustomMode(false);
    setCustomSplit('');
    setCategory('Groceries');
    setDescription('');
    setShowLogModal(true);
  };

  const handleSubmitSharedExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetLedgerId =
      ledger?.id ||
      getLedgerId(user.uid, user.partnerUid, user.email, user.partnerEmail);

    if (!user.partnerUid && !user.partnerEmail) {
      showToast('Please connect with your roommate first in the Partner tab.');
      return;
    }

    if (parsedTotal <= 0) {
      showToast('Please enter an amount greater than ₹0');
      return;
    }

    const effectiveOwe = otherOweAmount > 0 ? otherOweAmount : Math.round(parsedTotal / 2);

    if (effectiveOwe > parsedTotal) {
      showToast("Roommate's share cannot exceed the total amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const paidByUid = payer === 'me' ? user.uid : (user.partnerUid || 'partner_rm');
      const paidByName = payer === 'me' ? user.displayName : partnerName;

      // Construct timestamp with selected date
      const [year, month, day] = expenseDate.split('-').map(Number);
      const now = new Date();
      const splitDate = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );

      const members: [string, string] = [user.uid, user.partnerUid || 'partner_rm'];

      await addSharedTransaction(
        targetLedgerId,
        {
          paidBy: paidByUid,
          paidByName,
          totalAmount: parsedTotal,
          splitAmountOther: effectiveOwe,
          category,
          description: description.trim() || `${category} Split`,
          timestamp: splitDate.toISOString(),
        },
        members
      );

      setShowLogModal(false);
      showToast(`Shared expense of ${formatINR(parsedTotal)} logged!`);
      setTotalAmount('');
      setDescription('');
      setCustomSplit('');
    } catch (err) {
      console.error('Error logging shared expense', err);
      showToast('Failed to record shared expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSettleUp = async () => {
    if (!ledger || !ledger.id || userNetBalance === 0) return;

    setIsSubmitting(true);
    try {
      const amountToClear = Math.abs(userNetBalance);
      const payerUid = userNetBalance < 0 ? user.uid : (user.partnerUid || '');
      const payerName = userNetBalance < 0 ? user.displayName : partnerName;

      await settleUpLedger(ledger.id, payerUid, payerName, amountToClear);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#34d399', '#10b981', '#adc6ff', '#ffffff'],
        });
      } catch {
        // ignore confetti failures
      }

      setShowSettleModal(false);
      showToast('Ledger completely settled up (₹0.00)!');
    } catch (err) {
      console.error('Error settling ledger', err);
      showToast('Could not clear settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no partner linked
  if (!user.partnerUid) {
    return (
      <div className="flex flex-col gap-6 py-6 items-center text-center px-2">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#121a2d] to-[#1c263c] border border-white/10 flex items-center justify-center shadow-xl shadow-black/40">
          <span className="material-symbols-outlined text-[36px] text-[#34d399]">
            group_add
          </span>
        </div>

        <div className="flex flex-col gap-2 max-w-sm">
          <h2 className="text-xl font-bold font-headline text-white tracking-tight">
            Connect Your Roommate
          </h2>
          <p className="text-xs text-[#a0aec0] leading-relaxed">
            Equilibrium runs a bilateral zero-sum netting engine. Once paired, any shared groceries, rent, or utilities automatically offset against each other into a single live balance.
          </p>
        </div>

        <div className="p-5 glass-panel rounded-3xl w-full max-w-sm flex flex-col gap-3.5 shadow-xl">
          <div className="text-[11px] text-[#a0aec0] uppercase font-semibold tracking-wider">
            Your Roommate Invite Code
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#34d399] tracking-widest bg-[#070c18] py-3 rounded-2xl border border-white/10 shadow-inner">
            {user.pairCode || 'EQ-NONE'}
          </div>
          <p className="text-[11px] text-[#a0aec0]">
            Share this code with your roommate or enter theirs in the Partner tab.
          </p>
          <button
            onClick={onNavigateToPartner}
            className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-[#10b981]/25"
          >
            <span>Open Roommate Pairing</span>
            <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#121a2d]/95 backdrop-blur-md border border-[#34d399]/40 text-[#34d399] text-xs font-semibold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Cumulative Settlement Headline Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 border shadow-2xl flex flex-col gap-4 bg-gradient-to-br from-[#121a2d] to-[#0c1424] border-white/10">
        {/* Ambient Glow */}
        <div
          className={`absolute -right-8 -bottom-8 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            userNetBalance > 0
              ? 'bg-[#10b981]/20'
              : userNetBalance < 0
              ? 'bg-[#fb7185]/20'
              : 'bg-[#adc6ff]/15'
          }`}
        />

        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse"></span>
            <span className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider">
              Bilateral Zero-Sum Netting
            </span>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#070c18] text-[#dae2fd] text-[11px] font-medium border border-white/10 flex items-center gap-1.5 shadow-sm">
            <span className="text-[#a0aec0]">Partner:</span>
            <strong className="text-white font-semibold">{partnerName}</strong>
          </span>
        </div>

        {/* Dynamic Balance Headline Banner */}
        <div className="py-2">
          {userNetBalance > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10b981]/15 text-[#34d399] text-xs font-bold w-fit border border-[#10b981]/30">
                <span className="material-symbols-outlined text-[16px]">
                  arrow_upward_alt
                </span>
                <span>You are owed</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#34d399] font-headline tabular-nums tracking-tight">
                {partnerName} owes you {formatINR(userNetBalance)}
              </div>
              <p className="text-[11px] text-[#a0aec0]">
                Reciprocally computed from all shared bills and settlements.
              </p>
            </div>
          )}

          {userNetBalance < 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fb7185]/15 text-[#fb7185] text-xs font-bold w-fit border border-[#fb7185]/30">
                <span className="material-symbols-outlined text-[16px]">
                  arrow_downward_alt
                </span>
                <span>Outstanding Debt</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#fb7185] font-headline tabular-nums tracking-tight">
                You owe {partnerName} {formatINR(userNetBalance)}
              </div>
              <p className="text-[11px] text-[#a0aec0]">
                Tap Settle Up once you send the payment via UPI or cash.
              </p>
            </div>
          )}

          {userNetBalance === 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10b981]/15 text-[#34d399] text-xs font-bold w-fit border border-[#10b981]/30">
                <span className="material-symbols-outlined text-[16px]">
                  check_circle
                </span>
                <span>Perfect Equilibrium</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white font-headline tabular-nums tracking-tight">
                All Settled Up (₹0.00)
              </div>
              <p className="text-[11px] text-[#a0aec0]">
                All mutual expenses between you and {partnerName} are balanced.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons Row: Log Split & Settle Up */}
        <div className="flex items-center gap-2.5 pt-3 border-t border-white/10">
          <button
            onClick={handleOpenAddModal}
            className="flex-1 py-3.5 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-[#10b981]/25"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">
              call_split
            </span>
            <span>Split Expense</span>
          </button>

          {userNetBalance !== 0 && (
            <button
              onClick={() => setShowSettleModal(true)}
              className="px-5 py-3.5 bg-[#1c263c] hover:bg-[#26334f] text-white border border-white/10 rounded-2xl font-headline font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-[18px] text-[#fbbf24]">
                handshake
              </span>
              <span>Settle Up</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Activity Stream */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#a0aec0] uppercase tracking-wider font-headline">
              Shared Activity Stream
            </span>
            <span className="text-[10px] bg-[#121a2d] px-2 py-0.5 rounded-full text-[#34d399] font-mono border border-white/10">
              {transactions.length}
            </span>
          </div>
          <span className="text-[11px] text-[#a0aec0]">Real-time Netting</span>
        </div>

        {transactions.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1c263c] flex items-center justify-center text-[#a0aec0] shadow-inner">
              <span className="material-symbols-outlined text-[28px]">
                receipt_long
              </span>
            </div>
            <p className="text-sm font-bold text-white font-headline">No shared splits yet</p>
            <p className="text-xs text-[#a0aec0] max-w-xs leading-relaxed">
              Tap "Split Expense" above whenever you or {partnerName} front money for groceries, food delivery, or utilities.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {transactions.map((tx) => {
              const isSettlement = tx.isSettlement;
              const isMePayer = tx.paidBy === user.uid;
              const txDate = new Date(tx.timestamp);
              const formattedDate = txDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = txDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={tx.id}
                  className={`rounded-2xl p-4 border transition-all duration-200 shadow-md flex items-center justify-between ${
                    isSettlement
                      ? 'bg-[#10b981]/10 border-[#10b981]/30'
                      : 'glass-panel hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isSettlement
                          ? 'bg-[#10b981]/25 text-[#34d399]'
                          : 'bg-[#1c263c] text-[#adc6ff]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {isSettlement ? 'check_circle' : 'receipt_long'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{tx.description || tx.category}</span>
                        {isSettlement && (
                          <span className="px-1.5 py-0.5 rounded bg-[#34d399]/20 text-[#34d399] text-[9px] font-bold">
                            SETTLED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#a0aec0] mt-0.5">
                        <strong className="text-white font-medium">
                          {isMePayer ? 'You' : tx.paidByName}
                        </strong>{' '}
                        paid {formatINR(tx.totalAmount)} • {formattedDate}, {formattedTime}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isSettlement ? (
                      <div>
                        <div className="text-xs font-bold text-[#34d399] font-headline">
                          Cleared
                        </div>
                        <div className="text-[10px] text-[#a0aec0]">
                          {formatINR(tx.totalAmount)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div
                          className={`text-xs font-bold font-headline tabular-nums ${
                            isMePayer ? 'text-[#34d399]' : 'text-[#fb7185]'
                          }`}
                        >
                          {isMePayer ? `+${formatINR(tx.splitAmountOther)}` : `-${formatINR(tx.splitAmountOther)}`}
                        </div>
                        <div className="text-[10px] text-[#a0aec0]">
                          {isMePayer ? `${partnerName} owes` : 'You owe'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Shared Expense Modal (Bottom Sheet on Mobile) */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#10b981]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#34d399] text-[20px]">
                    call_split
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-headline">
                  Split Shared Expense
                </h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="w-8 h-8 rounded-full bg-[#1c263c] text-[#a0aec0] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitSharedExpense} className="flex flex-col gap-4">
              {/* Who Paid Toggle */}
              <div>
                <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                  Who Fronted the Bill?
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#070c18] p-1.5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPayer('me')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      payer === 'me'
                        ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                        : 'text-[#a0aec0] hover:text-white'
                    }`}
                  >
                    I Paid (Me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayer('partner')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      payer === 'partner'
                        ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                        : 'text-[#a0aec0] hover:text-white'
                    }`}
                  >
                    {partnerName} Paid
                  </button>
                </div>
              </div>

              {/* Date of Expense */}
              <div>
                <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                  Date of Split
                </label>
                <input
                  type="date"
                  required
                  max={getTodayStr()}
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-semibold text-white focus:border-[#34d399] focus:outline-none"
                />
              </div>

              {/* Total Amount Input */}
              <div>
                <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                  Total Amount Paid (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#34d399]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="E.g. 1200"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 bg-[#070c18] border border-white/10 rounded-2xl text-base font-bold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
                  />
                </div>
              </div>

              {/* Split Division Mode */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider">
                    How much should the other person pay?
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-[11px] text-[#34d399] font-semibold hover:underline"
                  >
                    {isCustomMode ? 'Use Percentage' : 'Enter Custom ₹'}
                  </button>
                </div>

                {!isCustomMode ? (
                  <div className="bg-[#070c18] p-3.5 rounded-2xl border border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setSplitRatio(50)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          splitRatio === 50
                            ? 'bg-[#10b981]/25 text-[#34d399] border border-[#10b981]/40'
                            : 'bg-[#1c263c] text-[#a0aec0]'
                        }`}
                      >
                        50 / 50 Equal Split
                      </button>
                      <span className="font-bold text-[#34d399] font-mono">
                        {splitRatio}% ({formatINR(otherOweAmount)})
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={splitRatio}
                      onChange={(e) => setSplitRatio(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-[#1c263c] rounded-lg appearance-none cursor-pointer accent-[#34d399]"
                    />

                    <div className="flex justify-between text-[11px] text-[#a0aec0] font-mono">
                      <span>You: {formatINR(myShareAmount)}</span>
                      <span>{partnerName}: {formatINR(otherOweAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-[#34d399]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      placeholder={`Amount ${partnerName} owes`}
                      value={customSplit}
                      onChange={(e) => setCustomSplit(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-semibold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Category Picker */}
              <div>
                <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {SHARED_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-2.5 rounded-2xl text-[11px] flex flex-col items-center gap-1.5 transition-all border ${
                        category === cat.name
                          ? 'bg-[#10b981]/20 border-[#34d399] text-[#34d399] font-bold shadow-sm'
                          : 'bg-[#070c18] border-white/10 text-[#a0aec0] hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {cat.icon}
                      </span>
                      <span className="truncate w-full text-center text-[10px]">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="E.g. Sunday grocery haul at Nature's Basket"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-xs text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
                />
              </div>

              {/* Submit Split Button */}
              <button
                type="submit"
                disabled={isSubmitting || parsedTotal <= 0}
                className="w-full py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">
                  check
                </span>
                <span>{isSubmitting ? 'Recording...' : 'Add Split to Ledger'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Action Sheet Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#fbbf24]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#fbbf24] text-[20px]">
                    handshake
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-headline">
                  Settle Up Bilateral Ledger
                </h3>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="w-8 h-8 rounded-full bg-[#1c263c] text-[#a0aec0] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-[#070c18] p-5 rounded-2xl border border-white/10 text-center flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-[#a0aec0] uppercase tracking-wider font-semibold">
                Settlement Amount
              </span>
              <div className="text-4xl font-extrabold font-headline text-[#34d399] tabular-nums tracking-tight">
                {formatINR(userNetBalance)}
              </div>
              <p className="text-xs text-[#a0aec0] mt-1">
                {userNetBalance < 0
                  ? `You are transferring ${formatINR(userNetBalance)} to ${partnerName}`
                  : `${partnerName} is transferring ${formatINR(userNetBalance)} to you`}
              </p>
            </div>

            <div className="text-xs text-[#a0aec0] bg-[#1c263c]/60 p-3.5 rounded-2xl border border-white/10 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#adc6ff] shrink-0 mt-0.5">
                info
              </span>
              <span className="leading-relaxed">
                Confirming settlement will log an official settlement receipt and reset the cumulative bilateral balance between you and {partnerName} to exactly ₹0.00.
              </span>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={handleConfirmSettleUp}
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">
                  done_all
                </span>
                <span>{isSubmitting ? 'Clearing...' : 'Confirm Full Settlement'}</span>
              </button>

              <button
                onClick={() => setShowSettleModal(false)}
                className="w-full py-2.5 text-xs text-[#a0aec0] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
