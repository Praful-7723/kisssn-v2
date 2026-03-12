import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Cloud, MessageSquare, Camera, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/weather', icon: Cloud, label: 'Weather' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/disease', icon: Camera, label: 'Scan' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0B1121] flex flex-col max-w-md mx-auto relative" data-testid="app-layout">
      <main className="flex-1 pb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto" data-testid="bottom-nav">
        <div className="glass rounded-t-2xl border-t border-white/10 px-2 py-2 flex justify-around items-center"
             style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path || (path === '/dashboard' && location.pathname === '/');
            return (
              <NavLink
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase()}`}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors duration-200 relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-1 w-8 h-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  size={20}
                  className={isActive ? 'text-orange-400' : 'text-slate-500'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={`text-[10px] font-medium ${isActive ? 'text-orange-400' : 'text-slate-500'}`}>
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
