import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, AlertTriangle, Mountain, Droplets, MapPin, Search, Mic, Square, Volume2 } from 'lucide-react';
import { getT } from '@/utils/translations';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SoilScannerPage() {
    const { user, updateUser } = useAuth();
    const t = getT(user?.language);

    const [preview, setPreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioPlayerRef = useRef(null);

    const hasLocation = user?.location?.lat && user?.location?.lon;
    const estimatedPh = user?.soil_profile?.ph;

    // Auto-fetch location if missing
    useEffect(() => {
        if (!hasLocation && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        const res = await fetch(`${API}/user/farm`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ location_lat: latitude, location_lon: longitude, location_name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` })
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
                            } else {
                                updateUser(data);
                            }
                        }
                    } catch { }
                },
                () => { },
                { enableHighAccuracy: true }
            );
        }
    }, [hasLocation, updateUser]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleFile = (file) => {
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            toast.error("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);

                // Immediately submit after recording stops
                submitAnalysis(imageFile, blob);
            };
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const submitAnalysis = async (img, audio) => {
        if (!img && !audio) {
            toast.error("Please provide an image or voice note.");
            return;
        }

        setResult(null);
        setLoading(true);
        setShowDashboard(false);

        try {
            let image_b64 = null;
            let audio_b64 = null;

            if (img) image_b64 = await toBase64(img);
            if (audio) audio_b64 = await toBase64(audio);

            const payload = {
                type: 'analysis',
                image_b64,
                audio_b64,
                ph: estimatedPh || "",
                language: user?.language || 'en',
                user_msg: "Analyze this input. Output JSON with the required keys.",
                system_msg: `You are an expert soil scientist and Indian agronomist named Kissan AI.
Context provided by user: The estimated geological pH is ${estimatedPh || 'unknown'}. 
You will receive an image of soil AND/OR a voice note describing a soil related issue. Keep your recommendations highly practical.
You MUST provide a comprehensive analysis including:
1. Soil characteristics.
2. Recommended fertilizers (MUST include amounts specifically calculated per acre OR per cent).
3. Recommended crops with the exact number of days they take to grow/harvest based on climate context.
Output ONLY valid JSON.
CRITICAL: ALL values inside the JSON, except keys themselves, MUST BE translated to the target language.
Use these EXACT keys: 'soil_type', 'estimated_ph_range', 'texture', 'moisture_level', 'fertilizer_recommendation', 'recommended_crops', 'summary_message'`
            };

            const res = await fetch(`https://rjuvlrajoqkezftnamij.supabase.co/functions/v1/ai-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                let parsedResult = {};
                try {
                    let text = data.text.trim();
                    if (text.startsWith('```')) {
                        text = text.split('\n').slice(1).join('\n').split('```')[0];
                    }
                    if (text.startsWith('json')) text = text.slice(4).trim();
                    parsedResult = JSON.parse(text);
                } catch (e) {
                    parsedResult = { error: "Failed to parse AI response" };
                }

                setResult(parsedResult);
                setShowDashboard(true);

                // Fetch TTS
                let textToSpeak = parsedResult.summary_message || "";
                if (!textToSpeak && parsedResult.fertilizer_recommendation) {
                    textToSpeak = Array.isArray(parsedResult.fertilizer_recommendation) ? parsedResult.fertilizer_recommendation.join(", ") : String(parsedResult.fertilizer_recommendation);
                }

                if (textToSpeak) {
                    try {
                        const ttsRes = await fetch(`https://rjuvlrajoqkezftnamij.supabase.co/functions/v1/ai-analysis`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'tts', user_msg: textToSpeak, language: user?.language || 'en' })
                        });
                        if (ttsRes.ok) {
                            const ttsData = await ttsRes.json();
                            if (ttsData.audio_base64) {
                                playAudio(`data:audio/wav;base64,${ttsData.audio_base64}`);
                            }
                        }
                    } catch (e) {
                        console.error("TTS fetch error", e);
                    }
                }
            } else {
                toast.error('Analysis failed');
            }
        } catch (e) {
            console.error(e);
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const playAudio = (b64Audio) => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
        }
        const audio = new Audio(b64Audio);
        audioPlayerRef.current = audio;
        audio.play();
    };

    const reset = () => {
        setPreview(null);
        setImageFile(null);
        setAudioBlob(null);
        setResult(null);
        setShowDashboard(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="p-4 space-y-5 pb-24" data-testid="soil-scanner-page">
            <div className="pt-2">
                <h1 className="font-['Outfit'] text-2xl font-bold text-gray-900 tracking-tight">Soil Intelligence</h1>
                <p className="text-sm text-gray-500 mt-1">Detect soil pH, get crop & fertilizer formulas</p>
            </div>

            {/* Auto Location & pH Context */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50/50">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shadow-inner">
                                <MapPin size={22} className="text-amber-700" />
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold text-amber-900">Current Geo-Profile</p>
                                <div className="flex gap-2 items-center mt-1">
                                    <Badge variant="outline" className="text-[11px] bg-white border-amber-200 text-amber-800 font-medium">
                                        <Mountain size={12} className="mr-1.5" /> Est. pH: {estimatedPh || 'Detecting...'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {!preview && !isRecording && !loading && !result ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <CardContent className="p-8 flex flex-col items-center text-center bg-white relative">
                            <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-orange-500"></div>

                            <div className="w-24 h-24 rounded-full bg-orange-50 flex items-center justify-center mb-6 shadow-sm border border-orange-100">
                                <Search size={40} className="text-orange-500" />
                            </div>
                            <h2 className="font-['Outfit'] text-xl font-bold text-gray-900 mb-2">Analyze Soil Condition</h2>
                            <p className="text-sm text-gray-500 mb-8 max-w-[280px]">Upload a photo or describe your soil issue using voice. AI will recommend specific fertilizers and crops.</p>

                            <div className="flex flex-col gap-3 w-full max-w-sm">
                                <div className="flex gap-3">
                                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                                    <Button onClick={() => cameraInputRef.current?.click()}
                                        className="flex-1 h-14 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 shadow-md hover:shadow-lg transition-all">
                                        <Camera size={20} /> Camera
                                    </Button>

                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                                    <Button onClick={() => fileInputRef.current?.click()} variant="outline"
                                        className="flex-1 h-14 rounded-2xl border border-gray-200 text-gray-800 font-semibold gap-2 hover:bg-gray-50 bg-white shadow-sm">
                                        <Upload size={20} /> Upload
                                    </Button>
                                </div>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-gray-100"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase tracking-widest">or</span>
                                    <div className="flex-grow border-t border-gray-100"></div>
                                </div>

                                <Button
                                    onClick={startRecording}
                                    className="w-full h-14 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold gap-2 transition-all border border-indigo-200">
                                    <Mic size={20} /> Add Voice Note
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            ) : null}

            {isRecording && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center py-10">
                    <Card className="rounded-3xl border-2 border-indigo-100 shadow-xl overflow-hidden w-full max-w-sm">
                        <CardContent className="p-8 flex flex-col items-center text-center bg-gradient-to-b from-white to-indigo-50/30">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6 shadow-inner"
                            >
                                <Mic size={40} />
                            </motion.div>
                            <h3 className="font-['Outfit'] text-xl font-bold text-gray-900 mb-2">Analyzing Voice...</h3>
                            <p className="text-4xl font-mono text-indigo-600 mb-8 font-light">{formatTime(recordingTime)}</p>
                            <Button
                                onClick={stopRecording}
                                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 text-lg shadow-md">
                                <Square size={20} fill="currentColor" /> Finish & Analyze
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {(preview || loading) && !isRecording && !result && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <Card className="rounded-3xl border border-gray-100 overflow-hidden shadow-md relative">
                        {preview ? (
                            <img src={preview} alt="Soil Input" className="w-full h-64 object-cover" />
                        ) : (
                            <div className="w-full h-64 bg-indigo-50 flex items-center justify-center flex-col">
                                <Mic size={48} className="text-indigo-300 mb-4" />
                                <span className="text-indigo-800 font-medium">Voice note attached</span>
                            </div>
                        )}

                        {(preview && !loading) && (
                            <div className="absolute bottom-4 inset-x-4 flex gap-3">
                                <Button onClick={reset} variant="secondary" className="flex-1 h-12 rounded-xl bg-white/90 backdrop-blur text-gray-800 font-semibold shadow-sm">
                                    Cancel
                                </Button>
                                <Button onClick={() => submitAnalysis(imageFile, audioBlob)} className="flex-1 h-12 rounded-xl bg-amber-600 text-white font-semibold shadow-md">
                                    Analyze Now
                                </Button>
                            </div>
                        )}

                        {loading && (
                            <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center backdrop-blur-md z-10 transition-all">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.15, 1],
                                        rotate: [0, 90, 180, 270, 360]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="relative w-20 h-20 mb-6 flex items-center justify-center"
                                >
                                    <div className="absolute inset-0 rounded-full border-[6px] border-amber-100"></div>
                                    <div className="absolute inset-0 rounded-full border-[6px] border-amber-500 border-t-transparent border-l-transparent animate-spin"></div>
                                    <div className="absolute inset-2 rounded-full border-[4px] border-orange-400 border-b-transparent border-r-transparent animate-spin-reverse"></div>
                                    <Search size={24} className="text-orange-600" />
                                </motion.div>
                                <h3 className="font-['Outfit'] text-xl font-bold text-gray-900 mb-1">Processing Analysis</h3>
                                <p className="text-sm text-gray-500 font-medium animate-pulse">Running AI models globally...</p>
                            </div>
                        )}
                    </Card>
                </motion.div>
            )}

            {showDashboard && result && !result.error && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="space-y-6"
                >
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-['Outfit'] text-2xl font-bold text-gray-900">Analysis Results</h2>
                        <Button onClick={reset} size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold">
                            Scan Again
                        </Button>
                    </div>

                    <Card className="rounded-3xl border-0 shadow-lg bg-white overflow-hidden ring-1 ring-gray-100">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex justify-between items-center text-white">
                            <div>
                                <p className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-1">Detected Soil Type</p>
                                <h3 className="font-['Outfit'] font-bold text-2xl">{result.soil_type || 'Unknown'}</h3>
                            </div>
                            {result.audio_url && (
                                <Button
                                    size="icon"
                                    onClick={() => playAudio(result.audio_url)}
                                    className="bg-white/20 hover:bg-white/30 text-white rounded-full h-12 w-12 border-0 backdrop-blur-md"
                                >
                                    <Volume2 size={24} />
                                </Button>
                            )}
                        </div>

                        <CardContent className="p-6 space-y-6">

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                                        <Mountain size={14} />
                                        <p className="text-[11px] font-bold uppercase tracking-wider">pH Estimate</p>
                                    </div>
                                    <p className="text-xl font-black text-gray-900">{result.estimated_ph_range || 'N/A'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                                        <Droplets size={14} />
                                        <p className="text-[11px] font-bold uppercase tracking-wider">Moisture</p>
                                    </div>
                                    <p className="text-xl font-black text-gray-900">{result.moisture_level || 'N/A'}</p>
                                </div>
                            </div>

                            {result.summary_message && (
                                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                    <p className="text-sm font-medium text-indigo-900 italic leading-relaxed">
                                        "{result.summary_message}"
                                    </p>
                                </div>
                            )}

                            {result.texture && (
                                <div>
                                    <p className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wide">Soil Texture</p>
                                    <p className="text-[15px] text-gray-700 leading-relaxed font-medium">{result.texture}</p>
                                </div>
                            )}

                            {result.fertilizer_recommendation && (
                                <motion.div
                                    className="p-5 rounded-2xl bg-green-50 border border-green-200 shadow-sm relative overflow-hidden"
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                    <div className="flex items-center gap-2 mb-3 relative">
                                        <div className="bg-green-100 p-1.5 rounded-lg border border-green-200">
                                            <Droplets size={18} className="text-green-700" />
                                        </div>
                                        <p className="text-sm text-green-900 font-bold uppercase tracking-wide">Fertilizer per Acre / Cent</p>
                                    </div>
                                    <div className="text-[15px] text-green-950 font-medium leading-relaxed relative z-10">
                                        {Array.isArray(result.fertilizer_recommendation) ? (
                                            <ul className="list-disc pl-5 space-y-1">
                                                {result.fertilizer_recommendation.map((f, i) => <li key={i}>{f}</li>)}
                                            </ul>
                                        ) : (
                                            <p>{String(result.fertilizer_recommendation)}</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {result.recommended_crops && (
                                <motion.div
                                    className="p-5 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm relative overflow-hidden"
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mb-10"></div>
                                    <div className="flex items-center gap-2 mb-3 relative">
                                        <p className="text-sm text-blue-800 font-bold uppercase tracking-wide">Ideal Crops & Duration</p>
                                    </div>
                                    <div className="text-[15px] text-blue-950 font-medium leading-relaxed relative z-10">
                                        {Array.isArray(result.recommended_crops) ? (
                                            <ul className="list-disc pl-5 space-y-2">
                                                {result.recommended_crops.map((c, i) => <li key={i}>{c}</li>)}
                                            </ul>
                                        ) : (
                                            <p>{String(result.recommended_crops)}</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {result?.error && (
                <Card className="rounded-2xl border border-red-200 mt-4"><CardContent className="p-4 text-center"><AlertTriangle size={24} className="text-red-500 mx-auto mb-2" /><p className="text-sm text-red-500">{result.error}</p><Button onClick={reset} variant="link" className="text-red-600 mt-2">Try Again</Button></CardContent></Card>
            )}

        </div>
    );
}
