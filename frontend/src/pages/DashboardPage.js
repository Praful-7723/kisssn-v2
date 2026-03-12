import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cloud, Droplets, Wind, MessageSquare, Camera, Lightbulb,
  Users, MapPin, Thermometer, ArrowRight, Sprout, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const weatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
};

const quickActions = [
  { id: 'chat', icon: MessageSquare, label: 'AI Chat', desc: 'Ask anything about farming', path: '/chat', color: 'from-blue-500/20 to-cyan-500/20', iconColor: 'text-blue-400', border: 'border-blue-500/20' },
  { id: 'scan', icon: Camera, label: 'Disease Scanner', desc: 'Scan plant diseases', path: '/disease', color: 'from-emerald-500/20 to-green-500/20', iconColor: 'text-emerald-400', border: 'border-emerald-500/20' },
  { id: 'recommend', icon: Lightbulb, label: 'Smart Tips', desc: 'Personalized advice', path: '/chat', color: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400', border: 'border-amber-500/20' },
  { id: 'community', icon: Users, label: 'Community', desc: 'Connect with farmers', path: '/community', color: 'from-purple-500/20 to-pink-500/20', iconColor: 'text-purple-400', border: 'border-purple-500/20' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('');

  const fetchWeather = useCallback(async () => {
    const lat = user?.location?.lat || 13.0;
    const lon = user?.location?.lon || 80.0;
    try {
      const res = await fetch(`${API}/weather?lat=${lat}&lon=${lon}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch (e) {
      console.error('Weather fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWeather();
    setLocationName(user?.location?.name || user?.farm_info?.location_name || 'Your Farm');
  }, [fetchWeather, user]);

  const temp = weather?.current?.temperature ?? '--';
  const weatherDesc = weather?.current?.weather_desc ?? 'Loading...';
  const weatherCode = weather?.current?.weather_code ?? 0;
  const humidity = weather?.current?.humidity ?? '--';
  const windSpeed = weather?.current?.wind_speed ?? '--';
  const sprayStatus = weather?.spraying?.status ?? 'Unknown';
  const sprayColor = weather?.spraying?.color ?? 'gray';

  const firstName = user?.name?.split(' ')[0] || 'Farmer';

  const stagger = {
    animate: { transition: { staggerChildren: 0.08 } }
  };
  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="p-4 space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between pt-2">
        <div>
          <p className="text-slate-500 text-sm">Good {getTimeOfDay()},</p>
          <h1 className="font-['Outfit'] text-2xl font-bold text-white">{firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-xs gap-1">
            <Sprout size={12} /> Kissan AI
          </Badge>
        </div>
      </motion.div>

      {/* Weather Card */}
      <motion.div {...fadeUp}>
        <Card
          className="glass rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all duration-300"
          onClick={() => navigate('/weather')}
          data-testid="weather-card"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-orange-400" />
                <span className="text-sm text-slate-400">{locationName}</span>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-5xl font-['Outfit'] font-bold text-white">
                  {typeof temp === 'number' ? `${Math.round(temp)}` : temp}
                  <span className="text-2xl text-slate-400">°C</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{weatherDesc}</p>
              </div>
              <div className="text-5xl">{weatherIcons[weatherCode] || '🌤️'}</div>
            </div>
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <Droplets size={14} className="text-blue-400" />
                <span className="text-xs text-slate-400">{humidity}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind size={14} className="text-cyan-400" />
                <span className="text-xs text-slate-400">{windSpeed} km/h</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className={`w-2 h-2 rounded-full ${sprayColor === 'green' ? 'bg-emerald-400' : sprayColor === 'orange' ? 'bg-amber-400' : 'bg-red-400'}`} />
                <span className={`text-xs font-medium ${sprayColor === 'green' ? 'text-emerald-400' : sprayColor === 'orange' ? 'text-amber-400' : 'text-red-400'}`}>
                  Spray: {sprayStatus}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Soil Profile Card */}
      {user?.soil_profile?.ph && (
        <motion.div {...fadeUp}>
          <Card className="glass rounded-2xl overflow-hidden" data-testid="soil-card">
            <CardContent className="p-5">
              <h3 className="font-['Outfit'] text-sm font-semibold text-slate-400 mb-3">SOIL PROFILE</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-slate-500 mb-1">pH Level</p>
                  <p className="text-lg font-bold text-orange-400">{user.soil_profile.ph}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-slate-500 mb-1">Type</p>
                  <p className="text-sm font-semibold text-white">{user.soil_profile.soil_type || 'N/A'}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-slate-500 mb-1">Source</p>
                  <p className="text-xs font-medium text-slate-300">{user.soil_profile.source === 'SoilGrids' ? 'Satellite' : 'Estimated'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={stagger} initial="initial" animate="animate">
        <h2 className="font-['Outfit'] text-sm font-semibold text-slate-400 mb-3 tracking-wide">SMART SUPPORT</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <motion.div key={action.id} variants={fadeUp}>
              <Card
                data-testid={`action-${action.id}`}
                className={`glass rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200 ${action.border}`}
                onClick={() => navigate(action.path)}
              >
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                    <action.icon size={20} className={action.iconColor} />
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-0.5">{action.label}</h3>
                  <p className="text-[11px] text-slate-500">{action.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Farming Tip */}
      <motion.div {...fadeUp}>
        <Card className="glass rounded-2xl border-orange-500/10" data-testid="tip-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb size={16} className="text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-400 mb-1">Daily Tip</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Check soil moisture before watering. Over-irrigation reduces root oxygen and can promote root rot. Morning watering is most efficient.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}
