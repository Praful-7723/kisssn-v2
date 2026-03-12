import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle2, Leaf, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DiseaseScannerPage() {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
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
      const res = await fetch(`${API}/disease/scan`, { method: 'POST', credentials: 'include', body: formData });
      if (res.ok) setResult(await res.json());
      else toast.error('Scan failed');
    } catch { toast.error('Connection error'); }
    finally { setLoading(false); }
  };

  const reset = () => { setPreview(null); setResult(null); };

  const statusColors = {
    'Healthy': 'text-green-700 bg-green-50 border-green-200',
    'Mild Issue': 'text-amber-700 bg-amber-50 border-amber-200',
    'Diseased': 'text-red-600 bg-red-50 border-red-200',
    'Critical': 'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <div className="p-4 space-y-5" data-testid="disease-scanner-page">
      <div className="pt-2">
        <h1 className="font-['Outfit'] text-xl font-bold text-gray-900">Disease Scanner</h1>
        <p className="text-xs text-gray-400 mt-0.5">AI-powered plant health analysis</p>
      </div>

      {!preview ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="upload-area">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-green-50 border border-green-200 flex items-center justify-center mb-5">
                <Leaf size={36} className="text-green-600" />
              </div>
              <h2 className="font-['Outfit'] text-lg font-bold text-gray-900 mb-1">Scan Your Plant</h2>
              <p className="text-xs text-gray-400 mb-6 max-w-[250px]">Take a photo or upload an image to detect diseases</p>
              <div className="flex gap-3 w-full max-w-xs">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                <Button data-testid="camera-btn" onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold gap-2 shadow-sm">
                  <Camera size={18} /> Camera
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                <Button data-testid="upload-btn" onClick={() => fileInputRef.current?.click()} variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-200 text-gray-700 font-semibold gap-2 hover:bg-gray-50">
                  <Upload size={18} /> Upload
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <Card className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="relative">
                <img src={preview} alt="Plant" className="w-full h-52 object-cover" />
                {loading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin text-green-600" />
                      <span className="text-sm text-gray-700 font-medium">Analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {result && !result.error && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl border border-gray-100 shadow-sm" data-testid="scan-result">
                  <CardContent className="p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-['Outfit'] text-lg font-bold text-gray-900">{result.plant_name || 'Unknown'}</h3>
                        <Badge className={`mt-1 ${statusColors[result.health_status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {result.health_status || 'Unknown'}
                        </Badge>
                      </div>
                      {result.confidence && (
                        <div className="text-right">
                          <p className="text-2xl font-['Outfit'] font-bold text-gray-900">{result.confidence}%</p>
                          <p className="text-[10px] text-gray-400">Confidence</p>
                        </div>
                      )}
                    </div>
                    {result.disease_name && result.disease_name !== 'None' && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                        <p className="text-xs text-red-600 font-semibold mb-0.5">Disease Detected</p>
                        <p className="text-sm text-gray-800">{result.disease_name}</p>
                      </div>
                    )}
                    {result.symptoms && (
                      <div>
                        <p className="text-xs text-gray-400 font-semibold mb-1.5">Symptoms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(result.symptoms) ? result.symptoms : [result.symptoms]).map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-gray-200 text-gray-600">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.treatment && (
                      <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                        <p className="text-xs text-green-700 font-semibold mb-0.5">Treatment</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{Array.isArray(result.treatment) ? result.treatment.join('. ') : result.treatment}</p>
                      </div>
                    )}
                    {result.prevention && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs text-blue-700 font-semibold mb-0.5">Prevention</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{Array.isArray(result.prevention) ? result.prevention.join('. ') : result.prevention}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {result?.error && (
              <Card className="rounded-2xl border border-red-200"><CardContent className="p-4 text-center"><AlertTriangle size={24} className="text-red-500 mx-auto mb-2" /><p className="text-sm text-red-500">{result.error}</p></CardContent></Card>
            )}
            <Button data-testid="scan-again-btn" onClick={reset} variant="outline" className="w-full h-11 rounded-xl border-gray-200 text-gray-600 gap-2">
              <RotateCcw size={15} /> Scan Another Plant
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
