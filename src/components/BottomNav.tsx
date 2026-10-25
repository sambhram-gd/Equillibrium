import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  sharedLedgerBalance?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  sharedLedgerBalance,
}) => {
  const tabs = [
    {
      id: 'personal-space' as TabType,
      label: 'My Space',
      icon: 'account_balance_wallet',
    },
    {
      id: 'shared-ledger' as TabType,
      label: 'Shared Ledger',
      icon: 'receipt_long',
      hasBadge: sharedLedgerBalance !== undefined && sharedLedgerBalance !== 0,
      badgeColor: sharedLedgerBalance && sharedLedgerBalance > 0 ? 'bg-[#4edea3]' : 'bg-[#ffb4ab]',
    },
    {
      id: 'partner-view' as TabType,
      label: 'Partner',
      icon: 'group',
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0b1326]/95 backdrop-blur-xl border-t border-[#171f33] pb-safe shadow-lg">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 w-24 h-14 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-[#4edea3] font-semibold'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              {/* Active ambient glow bar on top */}
              {isActive && (
                <span className="absolute -top-[1px] w-8 h-[2px] bg-[#4edea3] rounded-full shadow-[0_0_8px_#4edea3]" />
              )}

              <div className="relative">
                <span
                  className={`material-symbols-outlined text-[24px] transition-transform ${
                    isActive ? 'scale-110 font-bold' : ''
                  }`}
                >
                  {tab.icon}
                </span>

                {/* Badge if active shared balance */}
                {tab.hasBadge && (
                  <span
                    className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ${tab.badgeColor} ring-2 ring-[#0b1326]`}
                  />
                )}
              </div>

              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
