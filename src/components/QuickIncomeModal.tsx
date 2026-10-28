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
    <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#10b981]/20 flex items-center justify-center text-[#34d399]">
              <span className="material-symbols-outlined text-[20px]">
                add_circle
              </span>
            </div>
            <h3 className="text-base font-bold text-white font-headline">
              Add Funds to Vault
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1c263c] text-[#a0aec0] hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Income Type */}
          <div className="grid grid-cols-2 gap-2 bg-[#070c18] p-1.5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setIsSalary(true);
                setSourceNote('Monthly Salary');
              }}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                isSalary
                  ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                  : 'text-[#a0aec0] hover:text-white'
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
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                !isSalary
                  ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                  : 'text-[#a0aec0] hover:text-white'
              }`}
            >
              Other Deposit
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
              Amount Credited (₹)
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
                placeholder={isSalary ? '75000' : '5000'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-[#070c18] border border-white/10 rounded-2xl text-base font-bold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Source Note */}
          <div>
            <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
              Deposit Note / Reference
            </label>
            <input
              type="text"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="Source description"
              className="w-full px-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-xs text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !amount}
            className="w-full py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
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
