import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MobilePDFStyles } from './ui/MobilePDFStyles';

interface NavigationProps {
  onLogout: () => void;
  isAuthenticated: boolean;
  companyInfo?: { logo?: string; name?: string };
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  isActive?: (pathname: string) => boolean;
}

// Icons as inline SVGs for better quality than emojis
const Icons = {
  Dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Receipts: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Invoices: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  Payments: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  History: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Ledger: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Clients: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Truck: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  Reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Close: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Exit: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
};

const navigationItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard, path: '/dashboard', isActive: (pathname) => pathname === '/dashboard' },
  { id: 'lorry-receipts', label: 'Lorry Receipts', icon: Icons.Receipts, path: '/lorry-receipts', isActive: (pathname) => pathname.startsWith('/lorry-receipts') },
  { id: 'invoices', label: 'Invoices', icon: Icons.Invoices, path: '/invoices', isActive: (pathname) => pathname.startsWith('/invoices') },
  { id: 'payments', label: 'Payments', icon: Icons.Payments, path: '/payments', isActive: (pathname) => pathname === '/payments' },
  { id: 'transaction-history', label: 'Transaction History', icon: Icons.History, path: '/transaction-history', isActive: (pathname) => pathname === '/transaction-history' },
  { id: 'ledger', label: 'Ledger', icon: Icons.Ledger, path: '/enhanced-ledger', isActive: (pathname) => pathname.startsWith('/ledger') || pathname.startsWith('/enhanced-ledger') },
  { id: 'clients', label: 'Clients', icon: Icons.Clients, path: '/clients', isActive: (pathname) => pathname === '/clients' },
  { id: 'truck-hiring', label: 'Truck Hiring', icon: Icons.Truck, path: '/truck-hiring', isActive: (pathname) => pathname.startsWith('/truck-hiring') },
  { id: 'reports', label: 'Reports', icon: Icons.Reports, path: '/reports', isActive: (pathname) => pathname.startsWith('/reports') },
  { id: 'settings', label: 'Settings', icon: Icons.Settings, path: '/settings', isActive: (pathname) => pathname === '/settings' }
];

export const Navigation: React.FC<NavigationProps> = ({
  onLogout,
  isAuthenticated = false,
  companyInfo
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  // Don't render if checks
  if (isAuthenticated === undefined || !isAuthenticated) {
    return null;
  }

  const NavItemComponent: React.FC<{ item: NavItem; isMobile?: boolean }> = ({ item, isMobile = false }) => {
    const isActive = item.isActive ? item.isActive(location.pathname) : false;

    return (
      <Link
        to={item.path}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
        className={`
          group flex items-center w-full rounded-xl transition-all duration-200 relative
          ${isMobile ? 'px-4 py-3 mb-2' : 'px-3 py-3 justify-center flex-col min-h-[64px]'}
          ${isActive
            ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-200 backdrop-blur-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
        `}
      >
        <span className={`${isMobile ? 'mr-4' : 'mb-1.5'} transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
          {item.icon}
        </span>
        <span className={`font-medium ${isMobile ? 'text-base' : 'text-[10px]'} ${isActive ? 'font-semibold' : ''} ${!isMobile && 'opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-1 whitespace-nowrap bg-gray-800 text-white px-2 py-1 rounded text-xs z-20 pointer-events-none'}`}>
          {/* Tooltip style label for desktop, regular text for mobile */}
          {item.label}
        </span>

        {/* Desktop Active Indicator */}
        {isActive && !isMobile && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r-full" />
        )}

        {/* Mobile Active Indicator */}
        {isActive && isMobile && (
          <div className="absolute right-4 w-2 h-2 rounded-full bg-indigo-600" />
        )}
      </Link>
    );
  };

  return (
    <>
      <MobilePDFStyles />

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-20 lg:fixed lg:inset-y-0 lg:z-50 bg-white/80 backdrop-blur-md border-r border-gray-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo */}
          <div className="flex-none flex flex-col items-center justify-center p-4 border-b border-gray-100/50">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-2">
              {companyInfo?.logo ? (
                <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <span className="text-xl">🚛</span>
              )}
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto no-scrollbar">
            {navigationItems.map((item) => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-3 border-t border-gray-100/50">
            <button
              onClick={onLogout}
              className="group flex flex-col items-center justify-center w-full px-3 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              title="Logout"
            >
              <div className="mb-1 transition-transform duration-200 group-hover:scale-110">
                {Icons.Exit}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200/60 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-95 transition-all"
            >
              {Icons.Menu}
            </button>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              {companyInfo?.name || 'TranspoTruck'}
            </span>
          </div>

          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
            {companyInfo?.logo ? (
              <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
            ) : (
              'T'
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-[60] bg-gray-900/20 backdrop-blur-sm transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Sidebar Drawer */}
      <div className={`lg:hidden fixed top-0 left-0 bottom-0 w-[280px] z-[70] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Drawer Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
            <span className="text-lg font-bold text-gray-900">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              {Icons.Close}
            </button>
          </div>

          {/* Drawer Navigation */}
          <div className="flex-1 overflow-y-auto py-4 px-3">
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <NavItemComponent key={item.id} item={item} isMobile={true} />
              ))}
            </div>
          </div>

          {/* Drawer Footer / Logout */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onLogout}
              className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
            >
              <span className="mr-3">{Icons.Exit}</span>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
