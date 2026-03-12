import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  MapPin, Edit3, Save, LogOut, Sprout, Globe, ChevronRight,
  Leaf, Droplets, Mountain, User as UserIcon, X
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const cropOptions = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Soybean', 'Groundnut', 'Potato', 'Tomato', 'Onion', 'Chili', 'Turmeric', 'Banana', 'Mango', 'Coconut', 'Tea', 'Coffee'];

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [crops, setCrops] = useState([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (user) {
      setFarmName(user.farm_info?.farm_name || '');
      setFarmSize(user.farm_info?.farm_size || '');
      setCrops(user.farm_info?.crops || []);
      setLanguage(user.language || 'en');
    }
  }, [user]);

  const saveFarmInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/user/farm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ farm_name: farmName, farm_size: farmSize, crops })
      });
      if (res.ok) {
        const data = await res.json();
        updateUser(data);
        setEditing(false);
        toast.success('Farm info updated');
      }
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode
        let locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        try {
          const geoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            locationName = geoData.timezone?.split('/')[1]?.replace('_', ' ') || locationName;
          }
        } catch {}

        try {
          const res = await fetch(`${API}/user/farm`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ location_lat: latitude, location_lon: longitude, location_name: locationName })
          });
          if (res.ok) {
            const data = await res.json();
            updateUser(data);
            // Trigger soil estimation
            try {
              const soilRes = await fetch(`${API}/soil/estimate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ lat: latitude, lon: longitude })
              });
              if (soilRes.ok) {
                const soilData = await soilRes.json();
                updateUser({ ...data, soil_profile: soilData });
                toast.success(`Location set: ${locationName}. Soil pH: ${soilData.ph || 'Analyzing...'}`);
              }
            } catch {}
          }
        } catch { toast.error('Failed to update location'); }
        finally { setLocating(false); }
      },
      () => {
        toast.error('Location access denied');
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const toggleCrop = (crop) => {
    setCrops(prev => prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]);
  };

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    try {
      await fetch(`${API}/user/language`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: lang })
      });
      toast.success(lang === 'hi' ? 'Hindi selected' : 'English selected');
    } catch {}
  };

  return (
    <div className="p-4 space-y-5" data-testid="profile-page">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass rounded-2xl overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-orange-600/30 via-red-600/20 to-purple-600/30 relative" />
          <CardContent className="p-5 -mt-10 relative">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center border-4 border-[#12192B] shadow-xl">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <UserIcon size={28} className="text-white" />
                )}
              </div>
              <div className="flex-1 pb-1">
                <h2 className="font-['Outfit'] text-lg font-bold text-white">{user?.name || 'Farmer'}</h2>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-orange-400" />
                <span className="text-sm text-slate-300">
                  {user?.location?.name || 'No location set'}
                </span>
              </div>
              <Button
                data-testid="set-location-btn"
                size="sm"
                onClick={updateLocation}
                disabled={locating}
                className="h-8 rounded-lg bg-orange-500/10 text-orange-400 text-xs hover:bg-orange-500/20 border-0"
              >
                {locating ? 'Locating...' : user?.location?.name ? 'Update' : 'Set Location'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Soil Profile */}
      {user?.soil_profile?.ph && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass rounded-2xl" data-testid="soil-profile-card">
            <CardContent className="p-5">
              <h3 className="font-['Outfit'] text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Mountain size={14} /> SOIL PROFILE
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-[10px] text-slate-500 mb-0.5">pH Level</p>
                  <p className="text-xl font-['Outfit'] font-bold text-orange-400">{user.soil_profile.ph}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-[10px] text-slate-500 mb-0.5">Soil Type</p>
                  <p className="text-sm font-bold text-white">{user.soil_profile.soil_type || 'N/A'}</p>
                </div>
                {user.soil_profile.organic_carbon && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-[10px] text-slate-500 mb-0.5">Organic Carbon</p>
                    <p className="text-sm font-bold text-emerald-400">{user.soil_profile.organic_carbon} g/kg</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-[10px] text-slate-500 mb-0.5">Data Source</p>
                  <p className="text-xs font-medium text-slate-300">
                    {user.soil_profile.source === 'SoilGrids' ? 'ISRIC SoilGrids' : 'Regional Estimate'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Farm Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="glass rounded-2xl" data-testid="farm-info-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Outfit'] text-sm font-semibold text-slate-400 flex items-center gap-2">
                <Leaf size={14} /> FARM INFO
              </h3>
              <Button
                data-testid="edit-farm-btn"
                size="sm"
                onClick={() => editing ? saveFarmInfo() : setEditing(true)}
                disabled={saving}
                className="h-8 rounded-lg bg-white/5 text-slate-300 text-xs hover:bg-white/10 border-0 gap-1.5"
              >
                {editing ? <><Save size={12} /> Save</> : <><Edit3 size={12} /> Edit</>}
              </Button>
            </div>
            {editing ? (
              <div className="space-y-3">
                <Input
                  data-testid="farm-name-input"
                  placeholder="Farm name"
                  value={farmName}
                  onChange={e => setFarmName(e.target.value)}
                  className="h-10 rounded-xl bg-slate-950/50 border-white/10 text-white placeholder:text-slate-600 text-sm"
                />
                <Input
                  data-testid="farm-size-input"
                  placeholder="Farm size (e.g., 5 acres)"
                  value={farmSize}
                  onChange={e => setFarmSize(e.target.value)}
                  className="h-10 rounded-xl bg-slate-950/50 border-white/10 text-white placeholder:text-slate-600 text-sm"
                />
                <div>
                  <p className="text-xs text-slate-500 mb-2">Select Crops</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cropOptions.map(crop => (
                      <button
                        key={crop}
                        onClick={() => toggleCrop(crop)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          crops.includes(crop)
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {crop}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between py-2">
                  <span className="text-xs text-slate-500">Farm Name</span>
                  <span className="text-sm text-white">{user?.farm_info?.farm_name || 'Not set'}</span>
                </div>
                <Separator className="bg-white/5" />
                <div className="flex justify-between py-2">
                  <span className="text-xs text-slate-500">Size</span>
                  <span className="text-sm text-white">{user?.farm_info?.farm_size || 'Not set'}</span>
                </div>
                <Separator className="bg-white/5" />
                <div>
                  <span className="text-xs text-slate-500">Crops</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(user?.farm_info?.crops || []).length > 0 ? (
                      user.farm_info.crops.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">{c}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-600">No crops selected</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Language */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass rounded-2xl" data-testid="language-card">
          <CardContent className="p-5">
            <h3 className="font-['Outfit'] text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <Globe size={14} /> LANGUAGE
            </h3>
            <div className="flex gap-2">
              <button
                data-testid="lang-en"
                onClick={() => changeLanguage('en')}
                className={`flex-1 p-3 rounded-xl text-center transition-all ${
                  language === 'en' ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400' : 'bg-white/5 border border-white/5 text-slate-400'
                }`}
              >
                <p className="text-sm font-semibold">English</p>
              </button>
              <button
                data-testid="lang-hi"
                onClick={() => changeLanguage('hi')}
                className={`flex-1 p-3 rounded-xl text-center transition-all ${
                  language === 'hi' ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400' : 'bg-white/5 border border-white/5 text-slate-400'
                }`}
              >
                <p className="text-sm font-semibold">Hindi</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Logout */}
      <Button
        data-testid="logout-btn"
        onClick={logout}
        variant="outline"
        className="w-full h-12 rounded-xl bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10 font-semibold gap-2"
      >
        <LogOut size={16} /> Sign Out
      </Button>

      <div className="h-8" />
    </div>
  );
}
