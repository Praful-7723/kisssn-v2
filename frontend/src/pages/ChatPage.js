import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Send, Camera, Sparkles, Volume2, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

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
      } catch {}
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
        setMessages(prev => [...prev, { id: data.message_id, role: 'assistant', content: data.content, time: new Date().toISOString() }]);
      } else { toast.error('Failed to get response'); }
    } catch { toast.error('Connection error'); }
    finally { setIsLoading(false); }
  };

  const clearHistory = async () => {
    try { await fetch(`${API}/chat/history`, { method: 'DELETE', credentials: 'include' }); setMessages([]); toast.success('Chat cleared'); } catch {}
  };

  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { toast.error('Speech recognition not supported'); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.lang = user?.language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const speakText = async (text) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: text.substring(0, 500), language: user?.language === 'hi' ? 'hi-IN' : 'en-IN' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play(); return;
        }
      }
    } catch {}
    setIsSpeaking(false);
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
          <h1 className="font-['Outfit'] text-lg font-bold text-gray-900">Kissan AI Chat</h1>
          <p className="text-[10px] text-gray-400">Powered by Gemini AI</p>
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
            <h2 className="font-['Outfit'] text-lg font-bold text-gray-900 mb-1">Hello {user?.name?.split(' ')[0] || 'Farmer'}!</h2>
            <p className="text-xs text-gray-400 mb-5">Ask me anything about farming, crops, or soil</p>
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
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-md shadow-sm'
                  : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <button onClick={() => speakText(msg.content)} className="mt-1.5 text-gray-400 hover:text-green-600 transition-colors" data-testid="speak-btn">
                    <Volume2 size={13} className={isSpeaking ? 'text-green-600 animate-pulse' : ''} />
                  </button>
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
                <span className="text-xs text-gray-400">Thinking...</span>
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
            placeholder="Ask about farming..." className="flex-1 h-11 rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm" />
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
