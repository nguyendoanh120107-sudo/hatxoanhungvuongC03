import { useState } from 'react';
import type { TabKey } from '../types.ts';
import { Menu, X, Sparkles, BookOpen, Compass, ShieldCheck, User } from 'lucide-react';

interface NavbarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  hasApiKey: boolean;
}

export function Navbar({ activeTab, onSelectTab, hasApiKey }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const navLinks: { key: TabKey; label: string; icon: any }[] = [
    { key: 'home', label: 'Trang chủ', icon: Compass },
    { key: 'archive', label: 'Kho tư liệu', icon: BookOpen },
    { key: 'guilds', label: '4 Phường Xoan', icon: Compass },
    { key: 'sources', label: 'Nguồn & Cộng đồng', icon: ShieldCheck },
    { key: 'author', label: 'Tác giả', icon: User },
  ];

  const handleNavClick = (key: TabKey) => {
    onSelectTab(key);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-[#E7E2D6] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="text-left font-serif font-bold text-lg sm:text-xl tracking-tight text-[#1C1917] hover:text-[#9A3412] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg bg-[#9A3412] text-white flex items-center justify-center font-serif text-sm shadow-sm">
            X
          </div>
          <span className="font-serif">Hát Xoan & Thờ Hùng Vương</span>
        </button>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
          {navLinks.map((link) => {
            const isActive = activeTab === link.key;
            return (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNavClick(link.key)}
                className={`transition-colors whitespace-nowrap shrink-0 relative py-1 text-sm ${
                  isActive
                    ? 'text-[#9A3412] font-semibold'
                    : 'hover:text-[#1C1917] text-stone-600'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9A3412] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('ask')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-xs whitespace-nowrap shrink-0 ${
              activeTab === 'ask'
                ? 'bg-[#9A3412] text-white ring-2 ring-[#9A3412]/30'
                : 'bg-[#9A3412] hover:bg-[#832b0e] text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hỏi đáp Gemini</span>
          </button>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg focus:outline-none"
            aria-label="Mở bảng điều hướng"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E7E2D6] bg-[#FBF9F5] px-4 pt-3 pb-5 space-y-1 shadow-lg">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.key;
            return (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNavClick(link.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#9A3412]/10 text-[#9A3412] font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4 text-stone-500" />
                <span>{link.label}</span>
              </button>
            );
          })}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleNavClick('ask')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#9A3412] text-white text-sm font-semibold shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Hỏi đáp chuyên sâu bằng Gemini</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
