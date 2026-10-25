import React, { useState } from 'react';
import { UserProfile } from '../types';
import { addPersonalLog } from '../services/personalLogService';
import { updateUserProfile } from '../services/userService';

interface QuickIncomeModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

export const QuickIncomeModal: React.FC<QuickIncomeModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isSalary, setIsSalary] = useState<boolean>(true);
  const [sourceNote, setSourceNote] = useState<string>('Monthly Salary');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount) || 0;
    if (val <= 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });

      // Add personal credit log
      await addPersonalLog(user.uid, {
        amount: val,
        category: isSalary ? 'Salary' : 'Deposit',
        type: 'credit',
        timestamp: now.toISOString(),
        note: sourceNote.trim() || (isSalary ? 'Salary Credit' : 'Cash Deposit'),
      });

      // If it's salary, also update user's last salary metadata
      if (isSalary) {
        await updateUserProfile(user.uid, {
          salaryAmount: val,
          salaryDate: formattedDate,
        });
      }

      onSuccess(val);
      onClose();
    } catch (err) {
      console.error('Error logging credit', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-[#171f33] rounded-t-3xl sm:rounded-2xl border border-[#2d3449] p-5 shadow-2xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#2d3449]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4edea3]/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                add_circle
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#dae2fd] font-headline">
              Add Funds to Vault
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#bbcabf] hover:text-[#dae2fd] p-1 rounded-lg"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Income Type */}
          <div className="grid grid-cols-2 gap-2 bg-[#0b1326] p-1 rounded-xl border border-[#2d3449]">
            <button
              type="button"
              onClick={() => {
                setIsSalary(true);
                setSourceNote('Monthly Salary');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                isSalary
                  ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Salary Paycheck
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSalary(false);
                setSourceNote('Bank Transfer / Deposit');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                !isSalary
                  ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Other Deposit
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1">
              Amount Credited (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#4edea3]">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder={isSalary ? '75000' : '5000'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-[#0b1326] border border-[#2d3449] rounded-xl text-base font-bold text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none"
              />
            </div>
          </div>

          {/* Source Note */}
          <div>
            <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1">
              Note
            </label>
            <input
              type="text"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="Source description"
              className="w-full px-3.5 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !amount}
            className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">
              check
            </span>
            <span>{isSubmitting ? 'Crediting...' : 'Credit to Balance'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
