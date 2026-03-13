import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sprout, MapPin, Droplets, ChevronRight, Leaf, Globe, Check } from 'lucide-react';

const onboardingSlides = [
  {
    title: 'Namaste',
    subtitle: 'Welcome to Kissan AI',
    desc: 'Your intelligent farming companion powered by AI',
    icon: Sprout,
  },
  {
    title: 'Smart Soil Analysis',
    subtitle: 'Know Your Land',
    desc: 'GPS-based soil pH estimation and satellite data analysis for your farm',
    icon: MapPin,
  },
  {
    title: 'AI Advisory',
    subtitle: 'Expert Guidance',
    desc: 'Get crop recommendations, pest alerts, and fertilizer plans tailored to your soil',
    icon: Leaf,
  },
];

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' }
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden relative" data-testid="onboarding-page">
      {/* Subtle green gradient orbs */}
      <div className="absolute top-[-15%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-green-100/60 blur-[80px]" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[40vw] h-[40vw] rounded-full bg-emerald-50/80 blur-[60px]" />

      <AnimatePresence mode="wait">
        {step < onboardingSlides.length ? (
          <motion.div
            key={`slide-${step}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-center items-center px-8 py-12 relative z-10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="w-20 h-20 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mb-10"
            >
              {React.createElement(onboardingSlides[step].icon, { size: 40, className: 'text-green-600' })}
            </motion.div>

            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-['Outfit'] text-4xl sm:text-5xl font-bold gradient-text mb-3 text-center"
            >
              {onboardingSlides[step].title}
            </motion.h1>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-base text-gray-700 font-semibold mb-2"
            >
              {onboardingSlides[step].subtitle}
            </motion.p>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-gray-400 text-center max-w-xs leading-relaxed"
            >
              {onboardingSlides[step].desc}
            </motion.p>

            {/* Dots */}
            <div className="flex gap-2 mt-12">
              {onboardingSlides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-green-500' : 'w-1.5 bg-gray-200'
                    }`}
                />
              ))}
            </div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10 w-full max-w-xs"
            >
              <Button
                data-testid="onboarding-next-btn"
                onClick={() => setStep(s => s + 1)}
                className="w-full h-14 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-base shadow-md shadow-green-500/20 flex items-center justify-center gap-2"
              >
                {step === onboardingSlides.length - 1 ? 'Start setup' : 'Next'}
                <ChevronRight size={18} />
              </Button>
            </motion.div>

            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            )}
          </motion.div>
        ) : step === onboardingSlides.length ? (
          <motion.div
            key="lang-select"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex-1 flex flex-col justify-center items-center px-8 py-12 relative z-10 w-full max-w-sm mx-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-8"
            >
              <Globe size={40} className="text-blue-600" />
            </motion.div>

            <motion.h1
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-['Outfit'] text-3xl font-bold text-gray-900 mb-2 text-center"
            >
              Choose Language
            </motion.h1>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-gray-500 mb-8 text-center"
            >
              Select your preferred language for the app experience
            </motion.p>

            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="w-full grid grid-cols-2 gap-3 mb-10"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all flex flex-col items-center justify-center gap-1 ${selectedLanguage === lang.code
                    ? 'border-green-500 bg-green-50 shadow-sm'
                    : 'border-gray-100 hover:border-green-200 hover:bg-gray-50'
                    }`}
                >
                  <span className={`font-semibold text-lg ${selectedLanguage === lang.code ? 'text-green-700' : 'text-gray-900'}`}>{lang.native}</span>
                  <span className="text-xs text-gray-500 font-medium">{lang.name}</span>
                  {selectedLanguage === lang.code && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-full relative"
            >
              <Button
                data-testid="onboarding-next-btn"
                onClick={() => setStep(s => s + 1)}
                className="w-full h-14 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold text-base shadow-md shadow-green-500/20 flex items-center justify-center gap-2"
              >
                Get Started <ChevronRight size={18} />
              </Button>
              <button
                onClick={() => setStep(s => s - 1)}
                className="absolute left-1/2 -translate-x-1/2 mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex-1 flex flex-col justify-center items-center px-8 relative z-10"
          >
            <AuthForm navigate={navigate} selectedLanguage={selectedLanguage} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthForm({ navigate, selectedLanguage }) {
  const { login, register, loginWithGoogle, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }

      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/language`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: selectedLanguage }),
          credentials: 'include'
        });
      } catch (err) {
        console.error('Failed to set language', err);
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login('demo@kisan.ai', 'demo123');
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/language`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: selectedLanguage }),
          credentials: 'include'
        });
      } catch (err) { }
      navigate('/dashboard', { replace: true });
    } catch {
      try {
        await register('demo@kisan.ai', 'demo123', 'Demo Farmer');
        try {
          await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/language`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: selectedLanguage }),
            credentials: 'include'
          });
        } catch (err) { }
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError('Demo login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm" data-testid="auth-form">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
          <Sprout size={22} className="text-green-600" />
        </div>
        <span className="font-['Outfit'] text-lg font-bold text-green-700">Kissan AI</span>
      </div>

      <h2 className="font-['Outfit'] text-2xl font-bold text-gray-900 mb-1">
        {isLogin ? 'Welcome Back' : 'Create Account'}
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        {isLogin ? 'Sign in to your account' : 'Join Kissan AI to start smart farming'}
      </p>

      <div className="flex flex-col gap-3 mb-5">
        <Button
          data-testid="google-login-btn"
          onClick={loginWithGoogle}
          variant="outline"
          className="w-full h-12 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-3 font-medium"
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" fill="#4285F4" /><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" /><path d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9s0 0 0 0a9 9 0 0 0 .96 4.04l3.01-2.33z" fill="#FBBC05" /><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" /></svg>
          Continue with Google
        </Button>
        <Button
          type="button"
          onClick={handleDemoLogin}
          variant="secondary"
          className="w-full h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center font-medium"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Skip & Try Demo'}
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <Input
            data-testid="register-name-input"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12 rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400"
            required
          />
        )}
        <Input
          data-testid="email-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-12 rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400"
          required
        />
        <Input
          data-testid="password-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="h-12 rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400"
          required
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <Button
          data-testid="auth-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md shadow-green-500/20"
        >
          {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center mt-5 text-sm text-gray-400">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          data-testid="toggle-auth-mode"
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="text-green-600 hover:text-green-700 font-medium"
        >
          {isLogin ? 'Sign Up' : 'Sign In'}
        </button>
      </p>
    </div>
  );
}
