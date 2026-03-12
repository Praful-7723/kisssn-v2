import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API}/chat/history`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.map(m => ({
            id: m.message_id,
            role: m.role,
            content: m.content,
            time: m.created_at
          })));
        }
      } catch {}
    };
    loadHistory();
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: text, time: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, language: user?.language || 'en' })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: data.message_id,
          role: 'assistant',
          content: data.content,
          time: new Date().toISOString()
        }]);
      } else {
        toast.error('Failed to get response');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(`${API}/chat/history`, { method: 'DELETE', credentials: 'include' });
      setMessages([]);
      toast.success('Chat cleared');
    } catch {}
  };

  // Voice input using Web Speech API
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = user?.language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // TTS
  const speakText = async (text) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.substring(0, 500), language: user?.language === 'hi' ? 'hi-IN' : 'en-IN' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      }
    } catch {}
    setIsSpeaking(false);
    toast.error('Text-to-speech unavailable');
  };

  // Image upload for disease detection within chat
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const userMsg = { id: Date.now().toString(), role: 'user', content: '📷 Sent an image for analysis', time: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
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
        const content = data.error ? `Analysis error: ${data.error}` :
          `**Plant:** ${data.plant_name || 'Unknown'}\n**Status:** ${data.health_status || 'Unknown'}\n**Disease:** ${data.disease_name || 'None'}\n**Confidence:** ${data.confidence || 'N/A'}%\n\n**Treatment:** ${data.treatment || 'N/A'}\n\n**Prevention:** ${data.prevention || 'N/A'}`;
        setMessages(prev => [...prev, {
          id: Date.now().toString() + '_ai',
          role: 'assistant',
          content,
          time: new Date().toISOString()
        }]);
      }
    } catch {
      toast.error('Image analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]" data-testid="chat-page">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <div>
          <h1 className="font-['Outfit'] text-lg font-bold text-white">Kissan AI Chat</h1>
          <p className="text-[10px] text-slate-500">Powered by Gemini AI</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearHistory} data-testid="clear-chat-btn" className="text-slate-500 hover:text-red-400">
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/20 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-orange-400" />
            </div>
            <h2 className="font-['Outfit'] text-lg font-bold text-white mb-1">Hello {user?.name?.split(' ')[0] || 'Farmer'}!</h2>
            <p className="text-xs text-slate-500 mb-6">Ask me anything about farming, crops, or soil</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  data-testid={`suggestion-${i}`}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/20 hover:text-orange-400 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-br-md'
                  : 'glass text-slate-200 rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakText(msg.content)}
                    className="mt-2 text-slate-500 hover:text-orange-400 transition-colors"
                    data-testid="speak-btn"
                  >
                    <Volume2 size={14} className={isSpeaking ? 'text-orange-400 animate-pulse' : ''} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-orange-400" />
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/5 glass">
        <div className="flex items-center gap-2">
          <button
            data-testid="voice-input-btn"
            onClick={toggleVoice}
            className={`p-2.5 rounded-xl transition-all ${
              isListening ? 'bg-red-500 pulse-glow' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {isListening ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-slate-400" />}
          </button>
          <Input
            data-testid="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about farming..."
            className="flex-1 h-11 rounded-xl bg-slate-950/50 border-white/10 text-white placeholder:text-slate-600 text-sm"
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            data-testid="image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
          >
            <Camera size={18} className="text-slate-400" />
          </button>
          <Button
            data-testid="send-message-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 h-11 w-11"
            size="icon"
          >
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[9px] text-slate-600 text-center mt-2">Kissan AI learns - responses may vary</p>
      </div>
    </div>
  );
}
