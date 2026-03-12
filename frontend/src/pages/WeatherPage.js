import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, Wind, Thermometer, Eye,
  AlertTriangle, CheckCircle2, XCircle, MapPin, Calendar
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const weatherEmoji = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
};

const weatherDescs = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle',
  61: 'Slight Rain', 63: 'Rain', 65: 'Heavy Rain',
  80: 'Rain Showers', 81: 'Moderate Showers', 82: 'Heavy Showers', 95: 'Thunderstorm'
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  if (loading) return (
    <div className="p-4 space-y-4">
      <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
    </div>
  );

  const current = weather?.current || {};
  const spraying = weather?.spraying || {};
  const planner = weather?.hourly_planner || [];
  const daily = weather?.daily || {};

  return (
    <div className="p-4 space-y-5" data-testid="weather-page">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-gray-900">Weather</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={12} className="text-green-600" />
            <span className="text-xs text-gray-400">{user?.location?.name || 'Your Farm'}</span>
          </div>
        </div>
      </div>

      {/* Current Weather */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="current-weather">
        <CardContent className="p-6 text-center">
          <div className="text-6xl mb-2">{weatherEmoji[current.weather_code] || '🌤️'}</div>
          <div className="text-5xl font-['Outfit'] font-bold text-gray-900">
            {Math.round(current.temperature || 0)}<span className="text-2xl text-gray-400">°C</span>
          </div>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider text-xs">{current.weather_desc || 'Clear'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Feels like {Math.round(current.feels_like || 0)}°C</p>
          <div className="flex justify-center gap-8 mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <Droplets size={14} className="text-blue-500" />
              <span className="text-xs text-gray-500">{current.humidity}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind size={14} className="text-teal-500" />
              <span className="text-xs text-gray-500">{current.wind_speed} km/h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Thermometer size={14} className="text-red-500" />
              <span className="text-xs text-gray-500">{current.precipitation} mm</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="spraying" className="w-full">
        <TabsList className="w-full bg-gray-100 rounded-xl p-1">
          <TabsTrigger value="spraying" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs" data-testid="tab-spraying">
            <Calendar size={14} className="mr-1.5" /> Spraying
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs" data-testid="tab-forecast">
            <Eye size={14} className="mr-1.5" /> Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spraying" className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">Application Type</p>
            <div className="flex gap-2">
              {['herbicide', 'fungicide', 'insecticide'].map(type => (
                <button key={type} data-testid={`spray-${type}`} onClick={() => setSprayType(type)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                    sprayType === type ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                  }`}>{type}</button>
              ))}
            </div>
          </div>

          <Card className={`rounded-2xl border ${
            spraying.color === 'green' ? 'border-green-200 bg-green-50/30' :
            spraying.color === 'orange' ? 'border-amber-200 bg-amber-50/30' : 'border-red-200 bg-red-50/30'
          }`} data-testid="spray-window">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">Current Window</p>
                {spraying.color === 'green' ? <CheckCircle2 size={20} className="text-green-600" /> :
                 spraying.color === 'orange' ? <AlertTriangle size={20} className="text-amber-600" /> :
                 <XCircle size={20} className="text-red-500" />}
              </div>
              <h3 className={`text-2xl font-['Outfit'] font-bold ${
                spraying.color === 'green' ? 'text-green-700' : spraying.color === 'orange' ? 'text-amber-700' : 'text-red-600'
              }`}>{spraying.status}</h3>
              <div className="flex items-center gap-6 mt-2">
                <div>
                  <p className="text-[10px] text-gray-400">Delta T</p>
                  <p className={`text-sm font-bold ${spraying.delta_t >= 2 && spraying.delta_t <= 8 ? 'text-green-700' : 'text-amber-600'}`}>{spraying.delta_t}°C</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Wind</p>
                  <p className={`text-sm font-bold ${spraying.wind <= 10 ? 'text-green-700' : 'text-amber-600'}`}>{spraying.wind} km/h</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {(spraying.conditions || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {c.includes('Good') || c.includes('Ideal') || c.includes('Low') ? <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" /> : <XCircle size={12} className="text-red-500 flex-shrink-0" />}
                    <span className="text-xs text-gray-600">{c}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="font-['Outfit'] text-xs font-semibold text-gray-400 mb-2">Next 24h Planner</h3>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {planner.slice(0, 24).map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-xs text-gray-400 w-12 flex-shrink-0">
                    {h.time ? new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.color === 'green' ? 'bg-green-500' : h.color === 'orange' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-600 flex-1">{Math.round(h.temp)}°C</span>
                  <span className="text-xs text-gray-400">{h.wind} km/h</span>
                  <Badge variant="outline" className={`text-[10px] py-0 ${
                    h.status === 'Good' ? 'border-green-200 text-green-700' : h.status === 'Marginal' ? 'border-amber-200 text-amber-700' : 'border-red-200 text-red-600'
                  }`}>{h.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4 space-y-2">
          {(daily.time || []).map((day, i) => (
            <Card key={i} className="rounded-xl border border-gray-100 shadow-sm" data-testid={`forecast-day-${i}`}>
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{weatherEmoji[daily.weather_code?.[i]] || '🌤️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {i === 0 ? 'Today' : new Date(day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-gray-400">{weatherDescs[daily.weather_code?.[i]] || 'Clear'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{Math.round(daily.max_temp?.[i] || 0)}°</span>
                  <span className="text-sm text-gray-400 ml-1">{Math.round(daily.min_temp?.[i] || 0)}°</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
