import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sprout, MapPin, Leaf, Droplets, ThermometerSun, Mountain } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SuggestionsPage() {
  const { user, updateUser } = useAuth();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('crop');

  const hasLocation = user?.location?.lat && user?.location?.lon;
  const hasSoil = user?.soil_profile?.ph;

  const fetchSuggestions = useCallback(async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      } else {
        toast.error('Failed to get suggestions');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLocation && hasSoil) {
      fetchSuggestions(activeType);
    }
  }, [hasLocation, hasSoil, fetchSuggestions, activeType]);

  const requestLocation = async () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        try {
          const geoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`);
          if (geoRes.ok) {
            const d = await geoRes.json();
            locationName = d.timezone?.split('/')[1]?.replace(/_/g, ' ') || locationName;
          }
        } catch {}
        try {
          const res = await fetch(`${API}/user/farm`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ location_lat: latitude, location_lon: longitude, location_name: locationName })
          });
          if (res.ok) {
            const data = await res.json();
            const soilRes = await fetch(`${API}/soil/estimate`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ lat: latitude, lon: longitude })
            });
            if (soilRes.ok) {
              const soilData = await soilRes.json();
              updateUser({ ...data, soil_profile: soilData });
              toast.success(`Location set! Soil pH: ${soilData.ph}`);
            } else { updateUser(data); }
          }
        } catch {}
        finally { setLoading(false); }
      },
      () => { toast.error('Location access denied'); setLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  const types = [
    { key: 'crop', label: 'Crops', icon: Sprout },
    { key: 'fertilizer', label: 'Fertilizer', icon: Droplets },
    { key: 'irrigation', label: 'Irrigation', icon: ThermometerSun },
    { key: 'pest', label: 'Pest Control', icon: Leaf },
  ];

  return (
    <div className="p-4 space-y-5" data-testid="suggestions-page">
      <div className="pt-2">
        <h1 className="font-['Outfit'] text-xl font-bold text-gray-900">Crop Suggestions</h1>
        <p className="text-xs text-gray-400 mt-0.5">AI-powered recommendations for your farm</p>
      </div>

      {/* Location & Soil Info */}
      {hasLocation && hasSoil && (
        <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="farm-context-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-green-600" />
                <span className="text-xs text-gray-600">{user?.location?.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mountain size={13} className="text-amber-600" />
                <span className="text-xs text-gray-600">pH {user?.soil_profile?.ph}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Leaf size={13} className="text-emerald-600" />
                <span className="text-xs text-gray-600">{user?.soil_profile?.soil_type}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Location */}
      {!hasLocation && (
        <Card className="rounded-2xl border border-green-200 bg-green-50/50" data-testid="suggestion-location-prompt">
          <CardContent className="p-6 text-center">
            <MapPin size={32} className="text-green-600 mx-auto mb-3" />
            <h3 className="font-['Outfit'] font-bold text-gray-900 mb-1">Location Required</h3>
            <p className="text-xs text-gray-500 mb-4">Enable location to get personalized crop suggestions based on your soil and climate</p>
            <Button
              data-testid="suggestion-enable-location"
              onClick={requestLocation}
              disabled={loading}
              className="h-11 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold px-6 gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              Enable Location
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Type Tabs */}
      {hasLocation && hasSoil && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {types.map(t => (
              <button
                key={t.key}
                data-testid={`suggestion-type-${t.key}`}
                onClick={() => setActiveType(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeType === t.key
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 size={28} className="animate-spin text-green-600 mb-3" />
              <p className="text-sm text-gray-400">Analyzing your farm conditions...</p>
            </div>
          ) : suggestions?.recommendation ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="suggestion-result">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs">AI Generated</Badge>
                    <Badge variant="outline" className="text-xs text-gray-500 capitalize">{activeType}</Badge>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    {suggestions.recommendation.split('\n').map((line, i) => {
                      if (!line.trim()) return <br key={i} />;
                      if (line.startsWith('**') || line.startsWith('##')) {
                        const clean = line.replace(/[*#]/g, '').trim();
                        return <h4 key={i} className="font-['Outfit'] font-bold text-gray-900 text-sm mt-3 mb-1">{clean}</h4>;
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return (
                          <div key={i} className="flex items-start gap-2 py-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            <span className="text-xs text-gray-600 leading-relaxed">{line.replace(/^[-*]\s*/, '')}</span>
                          </div>
                        );
                      }
                      if (/^\d+[\.\)]/.test(line)) {
                        return (
                          <div key={i} className="flex items-start gap-2 py-0.5">
                            <span className="text-xs font-bold text-green-700 mt-0.5 flex-shrink-0">{line.match(/^\d+/)[0]}.</span>
                            <span className="text-xs text-gray-600 leading-relaxed">{line.replace(/^\d+[\.\)]\s*/, '')}</span>
                          </div>
                        );
                      }
                      return <p key={i} className="text-xs text-gray-600 leading-relaxed">{line}</p>;
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : suggestions?.error ? (
            <Card className="rounded-2xl border border-red-100">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-red-500">{suggestions.error}</p>
              </CardContent>
            </Card>
          ) : null}

          <Button
            data-testid="refresh-suggestions"
            onClick={() => fetchSuggestions(activeType)}
            disabled={loading}
            variant="outline"
            className="w-full h-10 rounded-xl border-gray-200 text-gray-600 text-xs"
          >
            Refresh Suggestions
          </Button>
        </>
      )}
    </div>
  );
}
