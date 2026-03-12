import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Leaf, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DiseaseScannerPage() {
  const { user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/disease/scan`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        toast.error('Scan failed');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
  };

  const statusColors = {
    'Healthy': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'Mild Issue': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Diseased': 'text-red-400 bg-red-500/10 border-red-500/20',
    'Critical': 'text-red-500 bg-red-500/20 border-red-500/30',
  };

  const urgencyIcons = {
    'low': CheckCircle2,
    'medium': AlertTriangle,
    'high': ShieldAlert,
    'critical': ShieldAlert,
  };

  return (
    <div className="p-4 space-y-5" data-testid="disease-scanner-page">
      <div className="pt-2">
        <h1 className="font-['Outfit'] text-xl font-bold text-white">Disease Scanner</h1>
        <p className="text-xs text-slate-500 mt-0.5">AI-powered plant health analysis</p>
      </div>

      {!preview ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Upload Area */}
          <Card className="glass rounded-2xl overflow-hidden" data-testid="upload-area">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 flex items-center justify-center mb-5">
                <Leaf size={36} className="text-emerald-400" />
              </div>
              <h2 className="font-['Outfit'] text-lg font-bold text-white mb-1">Scan Your Plant</h2>
              <p className="text-xs text-slate-500 mb-6 max-w-[250px]">Take a photo or upload an image of your plant to detect diseases</p>
              <div className="flex gap-3 w-full max-w-xs">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
                <Button
                  data-testid="camera-btn"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold gap-2"
                >
                  <Camera size={18} /> Camera
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
                <Button
                  data-testid="upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-semibold gap-2"
                >
                  <Upload size={18} /> Upload
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Image Preview */}
            <Card className="glass rounded-2xl overflow-hidden">
              <div className="relative">
                <img src={preview} alt="Plant" className="w-full h-56 object-cover" />
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-emerald-400" />
                      <span className="text-sm text-white font-medium">Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Results */}
            {result && !result.error && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass rounded-2xl" data-testid="scan-result">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-['Outfit'] text-lg font-bold text-white">{result.plant_name || 'Unknown Plant'}</h3>
                        <Badge className={`mt-1 ${statusColors[result.health_status] || 'bg-white/10 text-slate-400'}`}>
                          {result.health_status || 'Unknown'}
                        </Badge>
                      </div>
                      {result.confidence && (
                        <div className="text-right">
                          <p className="text-2xl font-['Outfit'] font-bold text-white">{result.confidence}%</p>
                          <p className="text-[10px] text-slate-500">Confidence</p>
                        </div>
                      )}
                    </div>

                    {result.disease_name && result.disease_name !== 'None' && (
                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                        <p className="text-xs text-red-400 font-semibold mb-1">Disease Detected</p>
                        <p className="text-sm text-white">{result.disease_name}</p>
                      </div>
                    )}

                    {result.symptoms && (
                      <div>
                        <p className="text-xs text-slate-500 font-semibold mb-2">Symptoms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(result.symptoms) ? result.symptoms : [result.symptoms]).map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-white/10 text-slate-400">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.treatment && (
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-xs text-emerald-400 font-semibold mb-1">Treatment</p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {Array.isArray(result.treatment) ? result.treatment.join('. ') : result.treatment}
                        </p>
                      </div>
                    )}

                    {result.prevention && (
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <p className="text-xs text-blue-400 font-semibold mb-1">Prevention</p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {Array.isArray(result.prevention) ? result.prevention.join('. ') : result.prevention}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {result?.error && (
              <Card className="glass rounded-2xl border-red-500/20">
                <CardContent className="p-4 text-center">
                  <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-400">{result.error}</p>
                </CardContent>
              </Card>
            )}

            {/* Scan Again */}
            <Button
              data-testid="scan-again-btn"
              onClick={reset}
              variant="outline"
              className="w-full h-12 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
            >
              <RotateCcw size={16} /> Scan Another Plant
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
