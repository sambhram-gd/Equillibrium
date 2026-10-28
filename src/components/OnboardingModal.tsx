import React, { useState } from 'react';
import { UserProfile } from '../types';
import { createUserProfile, generatePairCode, pairWithRoommate } from '../services/userService';

interface OnboardingModalProps {
  authUser: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
  };
  onComplete: (profile: UserProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  authUser,
  onComplete,
}) => {
  const [currentBalance, setCurrentBalance] = useState<string>('24450');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('30000');
  const [salaryAmount, setSalaryAmount] = useState<string>('75000');
  const [salaryDate, setSalaryDate] = useState<string>('Oct 1');
  const [roommateCodeOrEmail, setRoommateCodeOrEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(currentBalance) || 0;
    const budgetNum = parseFloat(monthlyBudget) || 0;
    const salaryNum = parseFloat(salaryAmount) || 0;

    if (balanceNum < 0) {
      setErrorMsg('Liquid balance cannot be negative');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const generatedCode = generatePairCode();
      const newProfile: UserProfile = {
        uid: authUser.uid,
        displayName: authUser.displayName || 'Roommate',
        email: authUser.email || '',
        photoURL: authUser.photoURL || undefined,
        currentBalance: balanceNum,
        monthlyBudget: budgetNum,
        salaryAmount: salaryNum,
        salaryDate: salaryDate.trim() || 'Recently',
        pairCode: generatedCode,
        createdAt: new Date().toISOString(),
      };

      // Create profile in Firestore
      await createUserProfile(newProfile);

      // If roommate code or email was provided, try linking immediately
      if (roommateCodeOrEmail.trim()) {
        try {
          const pairRes = await pairWithRoommate(newProfile, roommateCodeOrEmail.trim());
          if (pairRes.success && pairRes.partnerProfile) {
            newProfile.partnerUid = pairRes.partnerProfile.uid;
            newProfile.partnerEmail = pairRes.partnerProfile.email;
            newProfile.partnerName = pairRes.partnerProfile.displayName;
          }
        } catch (pairErr) {
          console.warn('Roommate pairing during onboarding deferred', pairErr);
        }
      }

      onComplete(newProfile);
    } catch (err) {
      console.error('Failed to complete onboarding', err);
      setErrorMsg('Could not set up profile. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#040812]/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-7 shadow-2xl flex flex-col gap-5 max-h-[95vh] overflow-y-auto pb-safe animate-in zoom-in-95 duration-200">
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

        {/* Header */}
        <div className="flex flex-col gap-1.5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#10b981] to-[#34d399] flex items-center justify-center shadow-xl shadow-[#10b981]/25 mx-auto mb-1">
            <span className="material-symbols-outlined text-[#013421] text-[32px] font-bold">
              balance
            </span>
          </div>
          <h2 className="text-2xl font-extrabold font-headline text-white tracking-tight">
            Welcome to Equilibrium
          </h2>
          <p className="text-xs text-[#a0aec0] max-w-xs mx-auto leading-relaxed">
            Let's configure your personal vault and bilateral ledger preferences.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-[#fb7185]/20 border border-[#fb7185]/40 text-[#fb7185] text-xs font-semibold rounded-2xl flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Question 1: Liquid Bank Balance */}
          <div>
            <label className="font-semibold text-[#a0aec0] block mb-1.5">
              1. What is your present liquid bank balance? (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#34d399] text-base">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                placeholder="24450"
                className="w-full pl-9 pr-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-base font-bold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 2: Monthly Budget Cap */}
          <div>
            <label className="font-semibold text-[#a0aec0] block mb-1.5">
              2. What is your monthly budget cap? (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#34d399] text-base">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="30000"
                className="w-full pl-9 pr-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-base font-bold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 3: Salary Credited Date & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#a0aec0] block mb-1.5">
                Last Salary (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#34d399] text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder="75000"
                  className="w-full pl-8 pr-3 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-[#34d399] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#a0aec0] block mb-1.5">
                Credited Date
              </label>
              <input
                type="text"
                value={salaryDate}
                onChange={(e) => setSalaryDate(e.target.value)}
                placeholder="Oct 1"
                className="w-full px-3.5 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-semibold text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 4: Roommate Pair Code / Email (Optional) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-[#a0aec0]">
                4. Roommate's Pair Code or Email
              </label>
              <span className="text-[10px] text-[#a0aec0]/70 font-mono">(Optional)</span>
            </div>
            <input
              type="text"
              value={roommateCodeOrEmail}
              onChange={(e) => setRoommateCodeOrEmail(e.target.value)}
              placeholder="E.g. EQ-49K2 or roommate@gmail.com"
              className="w-full px-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-semibold text-white focus:border-[#34d399] focus:outline-none uppercase"
            />
            <p className="text-[10px] text-[#a0aec0] mt-1.5">
              You can also pair anytime later from the Partner tab.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">
              rocket_launch
            </span>
            <span>{isSubmitting ? 'Configuring Vault...' : 'Launch Equilibrium'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
