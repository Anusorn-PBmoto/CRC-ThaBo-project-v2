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
      badgeColor: 'bg-amber-500 text-slate-950',
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
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0c1424]/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-2">
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
                  ? 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div className="relative">
                {tab.isSpecial && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-amber-400' : tab.isSpecial ? 'text-emerald-400' : ''
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
                    ? 'text-amber-400 font-bold'
                    : tab.isSpecial
                    ? 'text-emerald-300 font-medium'
                    : ''
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="w-5 h-0.5 bg-amber-400 rounded-full mt-0.5 shadow-sm shadow-amber-400/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
