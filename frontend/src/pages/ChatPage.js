import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Send, Camera, Sparkles, Volume2, Loader2, Trash2, Play, Pause, Square } from 'lucide-react';
import { getT } from '@/utils/translations';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL || 'https://kisssn-v2.onrender.com'}/api`;

const suggestions = [
  'Best crops for my soil?',
  'Fertilizer schedule',
  'Pest control tips',
  'Irrigation advice',
  'Market price trends',
  'Crop rotation plan',
];

export default function ChatPage() {
  const { user } = useAuth();
  const t = getT(user?.language);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Audio playback refs
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const currentChunkIndexRef = useRef(0);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API}/chat/history`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.map(m => ({ id: m.message_id, role: m.role, content: m.content, time: m.created_at })));
        }
      } catch { }
    };
    loadHistory();
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, time: new Date().toISOString() }]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ message: text, language: user?.language || 'en' })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: data.message_id,
          role: 'assistant',
          content: data.primary_text || data.content,
          english_translation: data.english_translation,
          audio_chunks: data.audio_chunks || [],
          time: new Date().toISOString()
        }]);
      } else { toast.error('Failed to get response'); }
    } catch { toast.error('Connection error'); }
    finally { setIsLoading(false); }
  };

  const clearHistory = async () => {
    try { await fetch(`${API}/chat/history`, { method: 'DELETE', credentials: 'include' }); setMessages([]); toast.success('Chat cleared'); } catch { }
  };

  const [transcriptData, setTranscriptData] = useState('');

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported'); return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const langMap = { 'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'ml': 'ml-IN', 'mr': 'mr-IN' };
    recognition.lang = langMap[user?.language] || 'en-IN';

    let currentFinal = '';

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      currentFinal += final;
      setInput(currentFinal + interim);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      setIsListening(false);
      // Wait a tick for the React state (input) to be captured by closure or just use `currentFinal`
      if (currentFinal.trim()) {
        sendMessage(currentFinal.trim());
      } else {
        // Fallback to reading the input state manually by referencing it if needed,
        // but since we dispatch sendMessage immediately, we can use a callback or just trust currentFinal.
        // Actually, we pass a function to setInput to also capture the value
        setInput((prev) => {
          if (prev.trim() && !currentFinal.trim()) sendMessage(prev.trim());
          return prev;
        });
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const playNextChunk = () => {
    if (currentChunkIndexRef.current < audioQueueRef.current.length) {
      const base64Audio = audioQueueRef.current[currentChunkIndexRef.current];
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audioRef.current = audio;
      audio.onended = () => {
        currentChunkIndexRef.current += 1;
        playNextChunk();
      };
      audio.onerror = () => {
        stopAudio();
        toast.error('Failed to play audio');
      };
      audio.play().catch(stopAudio);
    } else {
      stopAudio();
    }
  };

  const speakText = async (msgId, text, chunks) => {
    // If we have pre-generated chunks, play them directly
    if (chunks && chunks.length > 0) {
      stopAudio();
      setActiveMessageId(msgId);
      setIsPlaying(true);
      audioQueueRef.current = chunks;
      currentChunkIndexRef.current = 0;
      playNextChunk();
      return;
    }

    // Fallback: request TTS dynamically if no chunks
    if (activeMessageId === msgId && isPlaying) return;
    stopAudio();
    setActiveMessageId(msgId);
    setIsPlaying(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: text.substring(0, 500), language: user?.language === 'hi' ? 'hi-IN' : 'en-IN' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio_base64) {
          audioQueueRef.current = [data.audio_base64];
          currentChunkIndexRef.current = 0;
          playNextChunk();
          return;
        }
      }
    } catch { }
    stopAudio();
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resumeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (audioQueueRef.current.length > 0) {
      // It hasn't started yet but queue exists
      setIsPlaying(true);
      playNextChunk();
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    audioRef.current = null;
    audioQueueRef.current = [];
    currentChunkIndexRef.current = 0;
    setIsPlaying(false);
    setActiveMessageId(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: 'Sent an image for analysis', time: new Date().toISOString() }]);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch(`${API}/disease/scan`, { method: 'POST', credentials: 'include', body: formData });
      if (res.ok) {
        const data = await res.json();
        const content = data.error ? `Analysis error: ${data.error}` :
          `Plant: ${data.plant_name || 'Unknown'}\nStatus: ${data.health_status || 'Unknown'}\nDisease: ${data.disease_name || 'None'}\nConfidence: ${data.confidence || 'N/A'}%\n\nTreatment: ${data.treatment || 'N/A'}\n\nPrevention: ${data.prevention || 'N/A'}`;
        setMessages(prev => [...prev, { id: Date.now().toString() + '_ai', role: 'assistant', content, time: new Date().toISOString() }]);
      }
    } catch { toast.error('Image analysis failed'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]" data-testid="chat-page">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <h1 className="font-['Outfit'] text-lg font-bold text-gray-900">{t.aiChatTitle}</h1>
          <p className="text-[10px] text-gray-400">{t.poweredBy}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearHistory} data-testid="clear-chat-btn" className="text-gray-400 hover:text-red-500">
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-green-600" />
            </div>
            <h2 className="font-['Outfit'] text-lg font-bold text-gray-900 mb-1">{t.welcome} {user?.name?.split(' ')[0] || 'Farmer'}!</h2>
            <p className="text-xs text-gray-400 mb-5">{t.askMeAnything}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s, i) => (
                <button key={i} data-testid={`suggestion-${i}`} onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs text-gray-500 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                ? 'bg-green-600 text-white rounded-br-md shadow-sm'
                : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm'
                }`}>
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'assistant' ? 'text-gray-900 font-medium' : ''}`}>
                  {msg.content}
                </p>
                {msg.english_translation && (
                  <p className="mt-2 text-xs text-gray-400 italic font-medium whitespace-pre-wrap">
                    {msg.english_translation}
                  </p>
                )}

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                    {activeMessageId === msg.id && isPlaying ? (
                      <button onClick={pauseAudio} className="text-gray-400 hover:text-amber-500 transition-colors" title="Pause">
                        <Pause size={14} className="fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => activeMessageId === msg.id && audioRef.current ? resumeAudio() : speakText(msg.id, msg.content, msg.audio_chunks)}
                        className="text-gray-400 hover:text-green-600 transition-colors" title="Play"
                      >
                        <Play size={14} className="fill-current" />
                      </button>
                    )}

                    {activeMessageId === msg.id && (
                      <button onClick={stopAudio} className="text-gray-400 hover:text-red-500 transition-colors" title="Stop">
                        <Square size={14} className="fill-current" />
                      </button>
                    )}

                    {activeMessageId === msg.id && isPlaying && (
                      <div className="flex gap-0.5 ml-auto">
                        <div className="w-1 h-3 bg-green-500 animate-[pulse_1s_ease-in-out_infinite] rounded-full"></div>
                        <div className="w-1 h-2 bg-green-400 animate-[pulse_1s_ease-in-out_infinite_0.2s] rounded-full mt-1"></div>
                        <div className="w-1 h-3 bg-green-500 animate-[pulse_1s_ease-in-out_infinite_0.4s] rounded-full"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-green-600" />
                <span className="text-xs text-gray-400">{t.analyzing}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <button data-testid="voice-input-btn" onClick={toggleVoice}
            className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500 pulse-glow' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {isListening ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-gray-500" />}
          </button>
          <Input data-testid="chat-input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder={t.chatPlaceholder} className="flex-1 h-11 rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm" />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button data-testid="image-upload-btn" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all">
            <Camera size={18} className="text-gray-500" />
          </button>
          <Button data-testid="send-message-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-green-600 hover:bg-green-700 h-11 w-11" size="icon">
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">Kissan AI learns - responses may vary</p>
      </div>
    </div>
  );
}
