import React from 'react';
import { ListChecks, LayoutGrid, ShoppingCart, AlertTriangle, History } from 'lucide-react';

export type TabType = 'audit' | 'inventory' | 'buysell' | 'alerts' | 'history';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  discrepancyCount?: number;
  lowStockCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  discrepancyCount = 0,
  lowStockCount = 0,
}) => {
  const tabs = [
    {
      id: 'audit' as TabType,
      label: 'นับสต็อก',
      icon: ListChecks,
      badge: discrepancyCount > 0 ? discrepancyCount : undefined,
      badgeColor: 'bg-[#F6C90E] text-[#252C33]',
    },
    {
      id: 'inventory' as TabType,
      label: 'รายการสินค้า',
      icon: LayoutGrid,
    },
    {
      id: 'buysell' as TabType,
      label: 'ซื้อ/ขาย',
      icon: ShoppingCart,
      isSpecial: true,
    },
    {
      id: 'alerts' as TabType,
      label: 'สรุปยอด',
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'history' as TabType,
      label: 'ประวัติ',
      icon: History,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#20262D]/95 backdrop-blur-md border-t border-[#3A4750] px-2 py-2">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#F6C90E] font-semibold'
                  : 'text-[#A0ABB5] hover:text-[#EEEEEE] active:scale-95'
              }`}
            >
              <div className="relative">
                {tab.isSpecial && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F6C90E] animate-pulse" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-[#F6C90E]' : tab.isSpecial ? 'text-[#F6C90E]' : ''
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight truncate max-w-full ${
                  isActive
                    ? 'text-[#F6C90E] font-bold'
                    : tab.isSpecial
                    ? 'text-[#EEEEEE] font-medium'
                    : ''
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="w-5 h-0.5 bg-[#F6C90E] rounded-full mt-0.5 shadow-sm shadow-[#F6C90E]/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
