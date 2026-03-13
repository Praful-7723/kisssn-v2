import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Edit3, Save, LogOut, Sprout, Globe, Leaf, Droplets, Mountain, User as UserIcon, Loader2, Navigation } from 'lucide-react';
import { getT } from '@/utils/translations';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL || 'https://kisssn-v2.onrender.com'}/api`;
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
  const t = getT(user?.language);

  useEffect(() => {
    if (user) { setFarmName(user.farm_info?.farm_name || ''); setFarmSize(user.farm_info?.farm_size || ''); setCrops(user.farm_info?.crops || []); setLanguage(user.language || 'en'); }
  }, [user]);

  const saveFarmInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/user/farm`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ farm_name: farmName, farm_size: farmSize, crops })
      });
      if (res.ok) { updateUser(await res.json()); setEditing(false); toast.success('Farm info updated'); }
    } catch { toast.error('Failed to update'); } finally { setSaving(false); }
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let locationName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`; // Default to coordinates
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            locationName = addr.city || addr.town || addr.village || addr.county || locationName;
          }
        } catch { }
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
            if (soilRes.ok) { const soilData = await soilRes.json(); updateUser({ ...data, soil_profile: soilData }); toast.success(`Location: ${locationName} | Soil pH: ${soilData.ph}`); }
            else { updateUser(data); toast.success(`Location set: ${locationName}`); }
          }
        } catch { toast.error('Failed to update location'); } finally { setLocating(false); }
      },
      () => { toast.error('Location access denied'); setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const toggleCrop = (crop) => setCrops(prev => prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]);

  const changeLanguage = async (lang) => {
    if (lang === language) return;
    const confirmChange = window.confirm("Do you want to change language? The app will refresh to apply changes.");
    if (!confirmChange) return;

    setLanguage(lang);
    try {
      const res = await fetch(`${API}/user/language`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: lang })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      toast.error("Failed to change language");
    }
  };

  return (
    <div className="p-4 space-y-5" data-testid="profile-page">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 relative" />
          <CardContent className="p-5 -mt-8 relative">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                {user?.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : <UserIcon size={28} className="text-green-600" />}
              </div>
              <div className="flex-1 pb-1">
                <h2 className="font-['Outfit'] text-lg font-bold text-gray-900">{user?.name || 'Farmer'}</h2>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-green-600" />
                <span className="text-sm text-gray-600">{user?.location?.name || t.home}</span>
              </div>
              <Button data-testid="set-location-btn" size="sm" onClick={updateLocation} disabled={locating}
                className="h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs gap-1.5">
                {locating ? <><Loader2 size={12} className="animate-spin" /> {t.locating}</> : <><Navigation size={12} /> {user?.location?.name ? t.edit : t.save}</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Soil Profile */}
      {user?.soil_profile?.ph && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="soil-profile-card">
            <CardContent className="p-5">
              <h3 className="font-['Outfit'] text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2 tracking-wide"><Mountain size={14} /> {t.soilProfile}</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t.phLevel}</p>
                  <p className="text-xl font-['Outfit'] font-bold text-green-700">{user.soil_profile.ph}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t.soilType}</p>
                  <p className="text-sm font-bold text-gray-800">{user.soil_profile.soil_type || 'N/A'}</p>
                </div>
                {user.soil_profile.organic_carbon && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-[10px] text-gray-400 mb-0.5">Organic Carbon</p>
                    <p className="text-sm font-bold text-amber-700">{user.soil_profile.organic_carbon} g/kg</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t.source}</p>
                  <p className="text-xs font-medium text-gray-600">{user.soil_profile.source === 'SoilGrids' ? t.satellite : t.estimated}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Farm Info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="farm-info-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Outfit'] text-xs font-semibold text-gray-400 flex items-center gap-2 tracking-wide"><Leaf size={14} /> {t.farmInfo}</h3>
              <Button data-testid="edit-farm-btn" size="sm" onClick={() => editing ? saveFarmInfo() : setEditing(true)} disabled={saving}
                className="h-8 rounded-lg bg-gray-50 text-gray-600 text-xs hover:bg-gray-100 border border-gray-100 gap-1.5">
                {editing ? <><Save size={12} /> {t.save}</> : <><Edit3 size={12} /> {t.edit}</>}
              </Button>
            </div>
            {editing ? (
              <div className="space-y-3">
                <Input data-testid="farm-name-input" placeholder="Farm name" value={farmName} onChange={e => setFarmName(e.target.value)} className="h-10 rounded-xl border-gray-200 text-gray-900 text-sm" />
                <Input data-testid="farm-size-input" placeholder="Farm size (e.g., 5 acres)" value={farmSize} onChange={e => setFarmSize(e.target.value)} className="h-10 rounded-xl border-gray-200 text-gray-900 text-sm" />
                <div>
                  <p className="text-xs text-gray-400 mb-2">Select Crops</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cropOptions.map(crop => (
                      <button key={crop} onClick={() => toggleCrop(crop)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${crops.includes(crop) ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'}`}>
                        {crop}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex justify-between py-1.5"><span className="text-xs text-gray-400">{t.farmName}</span><span className="text-sm text-gray-800">{user?.farm_info?.farm_name || t.notSet}</span></div>
                <Separator className="bg-gray-100" />
                <div className="flex justify-between py-1.5"><span className="text-xs text-gray-400">{t.farmSize}</span><span className="text-sm text-gray-800">{user?.farm_info?.farm_size || t.notSet}</span></div>
                <Separator className="bg-gray-100" />
                <div>
                  <span className="text-xs text-gray-400">{t.crops}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(user?.farm_info?.crops || []).length > 0 ? user.farm_info.crops.map(c => (
                      <Badge key={c} className="text-[10px] bg-green-50 text-green-700 border border-green-200">{c}</Badge>
                    )) : <span className="text-xs text-gray-300">{t.notSet}</span>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Language */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="language-card">
          <CardContent className="p-5">
            <h3 className="font-['Outfit'] text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2 tracking-wide"><Globe size={14} /> {t.language}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'Hindi' },
                { code: 'ta', label: 'Tamil' },
                { code: 'te', label: 'Telugu' },
                { code: 'ml', label: 'Malayalam' },
                { code: 'mr', label: 'Marathi' }
              ].map(lang => (
                <button
                  key={lang.code}
                  data-testid={`lang-${lang.code}`}
                  onClick={() => changeLanguage(lang.code)}
                  className={`p-3 rounded-xl text-center transition-all ${language === lang.code ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                >
                  <p className="text-sm font-semibold">{lang.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Button data-testid="logout-btn" onClick={logout} variant="outline" className="w-full h-12 rounded-xl border-red-200 text-red-500 hover:bg-red-50 font-semibold gap-2">
        <LogOut size={16} /> {t.signOut}
      </Button>
      <div className="h-8" />
    </div>
  );
}
