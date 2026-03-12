import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cloud, Droplets, Wind, MessageSquare, Camera, Lightbulb,
  Users, MapPin, Sprout, ChevronRight, Navigation, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const weatherEmoji = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
};

const quickActions = [
  { id: 'suggest', icon: Lightbulb, label: 'Crop Suggestions', desc: 'What to grow', path: '/suggestions', bg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100' },
  { id: 'scan', icon: Camera, label: 'Disease Scanner', desc: 'Scan plant health', path: '/disease', bg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100' },
  { id: 'chat', icon: MessageSquare, label: 'AI Chat', desc: 'Ask anything', path: '/chat', bg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
  { id: 'community', icon: Users, label: 'Community', desc: 'Connect with farmers', path: '/community', bg: 'bg-purple-50', iconColor: 'text-purple-600', border: 'border-purple-100' },
];

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  const fetchWeather = useCallback(async () => {
    const lat = user?.location?.lat;
    const lon = user?.location?.lon;
    if (!lat || !lon) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/weather?lat=${lat}&lon=${lon}`, { credentials: 'include' });
      if (res.ok) setWeather(await res.json());
    } catch (e) {
      console.error('Weather fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const requestLocation = async () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        try {
          const geoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            locationName = geoData.timezone?.split('/')[1]?.replace(/_/g, ' ') || locationName;
          }
        } catch {}
        try {
          const res = await fetch(`${API}/user/farm`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ location_lat: latitude, location_lon: longitude, location_name: locationName })
          });
          if (res.ok) {
            const data = await res.json();
            // Auto soil estimation
            const soilRes = await fetch(`${API}/soil/estimate`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ lat: latitude, lon: longitude })
            });
            if (soilRes.ok) {
              const soilData = await soilRes.json();
              updateUser({ ...data, soil_profile: soilData });
              toast.success(`Location: ${locationName} | Soil pH: ${soilData.ph}`);
            } else {
              updateUser(data);
              toast.success(`Location set: ${locationName}`);
            }
          }
        } catch { toast.error('Failed to save location'); }
        finally { setLocating(false); fetchWeather(); }
      },
      () => { toast.error('Location access denied'); setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const temp = weather?.current?.temperature ?? '--';
  const weatherDesc = weather?.current?.weather_desc ?? '';
  const weatherCode = weather?.current?.weather_code ?? 0;
  const humidity = weather?.current?.humidity ?? '--';
  const windSpeed = weather?.current?.wind_speed ?? '--';
  const sprayStatus = weather?.spraying?.status ?? '';
  const sprayColor = weather?.spraying?.color ?? 'gray';
  const firstName = user?.name?.split(' ')[0] || 'Farmer';
  const hasLocation = user?.location?.lat && user?.location?.lon;

  const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <div className="p-4 space-y-5" data-testid="dashboard-page">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between pt-2">
        <div>
          <p className="text-gray-400 text-sm">Good {getTimeOfDay()},</p>
          <h1 className="font-['Outfit'] text-2xl font-bold text-gray-900">{firstName}</h1>
        </div>
        <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs gap-1 font-medium">
          <Sprout size={12} /> Kissan AI
        </Badge>
      </motion.div>

      {/* Location Prompt */}
      {!hasLocation && (
        <motion.div {...fadeUp}>
          <Card className="rounded-2xl border border-green-200 bg-green-50/50" data-testid="location-prompt">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mb-3">
                <Navigation size={24} className="text-green-600" />
              </div>
              <h3 className="font-['Outfit'] font-bold text-gray-900 mb-1">Set Your Farm Location</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-[260px]">Enable location to get soil analysis, weather data, and crop recommendations for your area</p>
              <Button
                data-testid="enable-location-btn"
                onClick={requestLocation}
                disabled={locating}
                className="h-11 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold px-6 gap-2 shadow-sm"
              >
                {locating ? <><Loader2 size={16} className="animate-spin" /> Locating...</> : <><MapPin size={16} /> Enable Location</>}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Weather Card */}
      {hasLocation && (
        <motion.div {...fadeUp}>
          <Card
            className="rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/weather')}
            data-testid="weather-card"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-green-600" />
                  <span className="text-sm text-gray-500">{user?.location?.name || 'Your Farm'}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-['Outfit'] font-bold text-gray-900">
                    {typeof temp === 'number' ? Math.round(temp) : temp}<span className="text-xl text-gray-400">°C</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{weatherDesc}</p>
                </div>
                <div className="text-5xl">{weatherEmoji[weatherCode] || '🌤️'}</div>
              </div>
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Droplets size={13} className="text-blue-500" />
                  <span className="text-xs text-gray-500">{humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind size={13} className="text-teal-500" />
                  <span className="text-xs text-gray-500">{windSpeed} km/h</span>
                </div>
                {sprayStatus && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className={`w-2 h-2 rounded-full ${sprayColor === 'green' ? 'bg-green-500' : sprayColor === 'orange' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-medium ${sprayColor === 'green' ? 'text-green-600' : sprayColor === 'orange' ? 'text-amber-600' : 'text-red-500'}`}>
                      Spray: {sprayStatus}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Soil Profile */}
      {user?.soil_profile?.ph && (
        <motion.div {...fadeUp}>
          <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="soil-card">
            <CardContent className="p-4">
              <h3 className="font-['Outfit'] text-xs font-semibold text-gray-400 mb-3 tracking-wide">SOIL PROFILE</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-green-50">
                  <p className="text-[10px] text-gray-500 mb-0.5">pH Level</p>
                  <p className="text-lg font-bold text-green-700">{user.soil_profile.ph}</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-gray-50">
                  <p className="text-[10px] text-gray-500 mb-0.5">Type</p>
                  <p className="text-xs font-semibold text-gray-800">{user.soil_profile.soil_type || 'N/A'}</p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-gray-50">
                  <p className="text-[10px] text-gray-500 mb-0.5">Source</p>
                  <p className="text-[10px] font-medium text-gray-600">{user.soil_profile.source === 'SoilGrids' ? 'Satellite' : 'Estimated'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial="initial" animate="animate">
        <h2 className="font-['Outfit'] text-xs font-semibold text-gray-400 mb-3 tracking-wide">SMART SUPPORT</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, i) => (
            <motion.div key={action.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card
                data-testid={`action-${action.id}`}
                className={`rounded-2xl border ${action.border} shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => navigate(action.path)}
              >
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-2.5`}>
                    <action.icon size={20} className={action.iconColor} />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-0.5">{action.label}</h3>
                  <p className="text-[11px] text-gray-400">{action.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Daily Tip */}
      <motion.div {...fadeUp}>
        <Card className="rounded-2xl border border-green-100 bg-green-50/40" data-testid="tip-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb size={15} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700 mb-0.5">Daily Tip</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Check soil moisture before watering. Over-irrigation reduces root oxygen and promotes root rot. Morning watering is most efficient.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}
