import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { updateUserProfile } from '../services/userService';

interface ProfileSettingsModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [displayName, setDisplayName] = useState<string>(user.displayName || '');
  const [salaryAmount, setSalaryAmount] = useState<string>((user.salaryAmount || 0).toString());
  const [salaryDate, setSalaryDate] = useState<string>(user.salaryDate || '1st of Month');
  const [monthlyBudget, setMonthlyBudget] = useState<string>((user.monthlyBudget || 30000).toString());
  const [currentBalance, setCurrentBalance] = useState<string>((user.currentBalance || 0).toString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setSalaryAmount((user.salaryAmount || 0).toString());
      setSalaryDate(user.salaryDate || '1st of Month');
      setMonthlyBudget((user.monthlyBudget || 30000).toString());
      setCurrentBalance((user.currentBalance || 0).toString());
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salVal = parseFloat(salaryAmount) || 0;
    const budVal = parseFloat(monthlyBudget) || 0;
    const balVal = parseFloat(currentBalance) || 0;

    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim() || user.displayName,
        salaryAmount: salVal,
        salaryDate: salaryDate.trim() || '1st of Month',
        monthlyBudget: budVal,
        currentBalance: balVal,
      });

      setSuccessMsg('Vault settings updated successfully!');
      setTimeout(() => {
        setSuccessMsg(null);
        if (onSuccess) onSuccess();
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to update profile settings', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#34d399]/15 flex items-center justify-center text-[#34d399] ring-1 ring-[#34d399]/30">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-headline">
                Vault & Salary Settings
              </h3>
              <p className="text-[10px] text-[#94a3b8]">
                Configure monthly budget, salary cycle, and live balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1c263c] text-[#a0aec0] hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-3 bg-[#10b981]/20 border border-[#10b981]/40 text-[#34d399] text-xs font-bold rounded-2xl flex items-center gap-2 animate-in zoom-in-95">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Display Name */}
          <div>
            <label className="font-semibold text-[#a0aec0] block mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-semibold text-white focus:border-[#34d399] focus:outline-none"
            />
          </div>

          {/* Salary Amount & Salary Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#a0aec0] block mb-1">
                Monthly Salary (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#34d399]">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-bold text-white focus:border-[#34d399] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#a0aec0] block mb-1">
                Salary Credited Date / Cycle
              </label>
              <input
                type="text"
                value={salaryDate}
                onChange={(e) => setSalaryDate(e.target.value)}
                placeholder="e.g. Oct 1 or 1st of Month"
                className="w-full px-3 py-2.5 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-semibold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Monthly Budget Cap */}
          <div>
            <label className="font-semibold text-[#a0aec0] block mb-1">
              Monthly Budget Cap (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#34d399]">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-bold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-[#94a3b8] mt-1">
              Used to calculate monthly burndown progress and alerts.
            </p>
          </div>

          {/* Liquid Vault Balance Calibration */}
          <div>
            <label className="font-semibold text-[#a0aec0] block mb-1">
              Current Liquid Bank Balance (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#34d399]">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 bg-[#070c18] border border-white/10 rounded-2xl text-xs font-bold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-[#94a3b8] mt-1">
              Calibrate your live balance if your real bank account changed outside the app.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-[#94a3b8] hover:text-white rounded-2xl font-bold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#10b981]/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">check</span>
              <span>{isSubmitting ? 'Saving...' : 'Update Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
