import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Cloud, Droplets, Wind, Thermometer, Eye, Sunrise, Sunset,
  AlertTriangle, CheckCircle2, XCircle, MapPin, Calendar
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const weatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
};

const weatherDescs = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle',
  61: 'Slight Rain', 63: 'Rain', 65: 'Heavy Rain',
  80: 'Rain Showers', 81: 'Moderate Showers', 82: 'Heavy Showers',
  95: 'Thunderstorm'
};

export default function WeatherPage() {
  const { user } = useAuth();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sprayType, setSprayType] = useState('herbicide');

  const fetchWeather = useCallback(async () => {
    const lat = user?.location?.lat || 13.0;
    const lon = user?.location?.lon || 80.0;
    try {
      const res = await fetch(`${API}/weather?lat=${lat}&lon=${lon}`, { credentials: 'include' });
      if (res.ok) setWeather(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  const current = weather?.current || {};
  const spraying = weather?.spraying || {};
  const planner = weather?.hourly_planner || [];
  const daily = weather?.daily || {};
  const locationName = user?.location?.name || 'Your Farm';

  return (
    <div className="p-4 space-y-5" data-testid="weather-page">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-white">Weather</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={12} className="text-orange-400" />
            <span className="text-xs text-slate-400">{locationName}</span>
          </div>
        </div>
      </div>

      {/* Current Weather */}
      <Card className="glass rounded-2xl overflow-hidden" data-testid="current-weather">
        <CardContent className="p-6 text-center">
          <div className="text-6xl mb-2">{weatherIcons[current.weather_code] || '🌤️'}</div>
          <div className="text-6xl font-['Outfit'] font-bold text-white">
            {Math.round(current.temperature || 0)}<span className="text-3xl text-slate-400">°C</span>
          </div>
          <p className="text-sm text-slate-400 mt-1 uppercase tracking-wider">{current.weather_desc || 'Clear'}</p>
          <p className="text-xs text-slate-500 mt-1">Feels like {Math.round(current.feels_like || 0)}°C</p>
          <div className="flex justify-center gap-8 mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Droplets size={14} className="text-blue-400" />
              <span className="text-xs text-slate-400">{current.humidity}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind size={14} className="text-cyan-400" />
              <span className="text-xs text-slate-400">{current.wind_speed} km/h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Thermometer size={14} className="text-red-400" />
              <span className="text-xs text-slate-400">{current.precipitation} mm</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Spraying / Forecast */}
      <Tabs defaultValue="spraying" className="w-full">
        <TabsList className="w-full bg-white/5 rounded-xl p-1">
          <TabsTrigger value="spraying" className="flex-1 rounded-lg data-[state=active]:bg-white/10 text-xs" data-testid="tab-spraying">
            <Calendar size={14} className="mr-1.5" /> Spraying
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex-1 rounded-lg data-[state=active]:bg-white/10 text-xs" data-testid="tab-forecast">
            <Eye size={14} className="mr-1.5" /> Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spraying" className="mt-4 space-y-4">
          {/* Application Type */}
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium">Application Type</p>
            <div className="flex gap-2">
              {['herbicide', 'fungicide', 'insecticide'].map(type => (
                <button
                  key={type}
                  data-testid={`spray-${type}`}
                  onClick={() => setSprayType(type)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                    sprayType === type
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Current Spray Window */}
          <Card className={`rounded-2xl overflow-hidden border ${
            spraying.color === 'green' ? 'border-emerald-500/20 bg-emerald-950/20' :
            spraying.color === 'orange' ? 'border-amber-500/20 bg-amber-950/20' :
            'border-red-500/20 bg-red-950/20'
          }`} data-testid="spray-window">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">Current Window</p>
                {spraying.color === 'green' ? <CheckCircle2 size={20} className="text-emerald-400" /> :
                 spraying.color === 'orange' ? <AlertTriangle size={20} className="text-amber-400" /> :
                 <XCircle size={20} className="text-red-400" />}
              </div>
              <h3 className={`text-2xl font-['Outfit'] font-bold ${
                spraying.color === 'green' ? 'text-emerald-400' :
                spraying.color === 'orange' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {spraying.status}
              </h3>
              <div className="flex items-center gap-6 mt-3">
                <div>
                  <p className="text-[10px] text-slate-500">Delta T</p>
                  <p className={`text-sm font-bold ${
                    spraying.delta_t >= 2 && spraying.delta_t <= 8 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>{spraying.delta_t}°C</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Wind</p>
                  <p className={`text-sm font-bold ${
                    spraying.wind <= 10 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>{spraying.wind} km/h</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {(spraying.conditions || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {c.includes('Good') || c.includes('Ideal') || c.includes('Low') ? (
                      <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-slate-400">{c}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 24h Planner */}
          <div>
            <h3 className="font-['Outfit'] text-sm font-semibold text-slate-400 mb-3">Next 24h Spraying Planner</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {planner.slice(0, 24).map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                  <span className="text-xs text-slate-500 w-12 flex-shrink-0">
                    {h.time ? new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    h.color === 'green' ? 'bg-emerald-400' : h.color === 'orange' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="text-xs text-slate-400 flex-1">{Math.round(h.temp)}°C</span>
                  <span className="text-xs text-slate-500">{h.wind} km/h</span>
                  <Badge variant="outline" className={`text-[10px] py-0 ${
                    h.status === 'Good' ? 'border-emerald-500/30 text-emerald-400' :
                    h.status === 'Marginal' ? 'border-amber-500/30 text-amber-400' :
                    'border-red-500/30 text-red-400'
                  }`}>
                    {h.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4 space-y-3">
          {(daily.time || []).map((day, i) => (
            <Card key={i} className="glass rounded-xl" data-testid={`forecast-day-${i}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{weatherIcons[daily.weather_code?.[i]] || '🌤️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {i === 0 ? 'Today' : new Date(day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {weatherDescs[daily.weather_code?.[i]] || 'Clear'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-white">{Math.round(daily.max_temp?.[i] || 0)}°</span>
                  <span className="text-sm text-slate-500 ml-1">{Math.round(daily.min_temp?.[i] || 0)}°</span>
                  {daily.precipitation?.[i] > 0 && (
                    <p className="text-[10px] text-blue-400">{daily.precipitation[i]}mm</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
