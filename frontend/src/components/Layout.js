import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Lightbulb, MessageSquare, Camera, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/suggestions', icon: Lightbulb, label: 'Suggest' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/disease', icon: Camera, label: 'Scan' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative" data-testid="app-layout">
      <main className="flex-1 pb-20 overflow-y-auto bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto" data-testid="bottom-nav">
        <div className="bg-white border-t border-gray-100 px-2 py-2 flex justify-around items-center shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
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
                    className="absolute -top-2 w-8 h-1 rounded-full bg-green-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  size={20}
                  className={isActive ? 'text-green-600' : 'text-gray-400'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={`text-[10px] font-medium ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
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
