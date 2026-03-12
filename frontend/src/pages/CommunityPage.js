import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, MessageCircle, Plus, User as UserIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [creating, setCreating] = useState(false);

  const loadPosts = async () => {
    try { const res = await fetch(`${API}/community/posts`, { credentials: 'include' }); if (res.ok) setPosts(await res.json()); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { loadPosts(); }, []);

  const createPost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/community/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ title: newTitle, content: newContent, category: newCategory })
      });
      if (res.ok) { toast.success('Post created'); setNewTitle(''); setNewContent(''); setShowCreate(false); loadPosts(); }
    } catch { toast.error('Failed to create post'); }
    finally { setCreating(false); }
  };

  const likePost = async (postId) => {
    try {
      const res = await fetch(`${API}/community/posts/${postId}/like`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.post_id === postId
          ? { ...p, likes: data.liked ? p.likes + 1 : p.likes - 1, liked_by: data.liked ? [...(p.liked_by||[]), user?.user_id] : (p.liked_by||[]).filter(id => id !== user?.user_id) }
          : p));
      }
    } catch {}
  };

  const categories = ['general', 'crops', 'pest', 'market', 'irrigation', 'soil'];
  const catColors = {
    general: 'bg-gray-50 text-gray-600 border-gray-200', crops: 'bg-green-50 text-green-700 border-green-200',
    pest: 'bg-red-50 text-red-600 border-red-200', market: 'bg-blue-50 text-blue-600 border-blue-200',
    irrigation: 'bg-cyan-50 text-cyan-700 border-cyan-200', soil: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const timeAgo = (d) => { if (!d) return ''; const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s/60)}m`; if (s < 86400) return `${Math.floor(s/3600)}h`; return `${Math.floor(s/86400)}d`; };

  return (
    <div className="p-4 space-y-5" data-testid="community-page">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-gray-900">Community</h1>
          <p className="text-xs text-gray-400">Connect with fellow farmers</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="create-post-btn" className="h-9 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold gap-1.5 px-4 shadow-sm">
              <Plus size={14} /> Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-gray-200 max-w-sm mx-auto">
            <DialogHeader><DialogTitle className="text-gray-900 font-['Outfit']">Create Post</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input data-testid="post-title-input" placeholder="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                className="rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400" />
              <Textarea data-testid="post-content-input" placeholder="Share your question or knowledge..." value={newContent} onChange={e => setNewContent(e.target.value)}
                className="rounded-xl border-gray-200 text-gray-900 placeholder:text-gray-400 min-h-[100px]" />
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button key={c} onClick={() => setNewCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${newCategory === c ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <Button data-testid="submit-post-btn" onClick={createPost} disabled={creating || !newTitle.trim() || !newContent.trim()}
                className="w-full h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold">
                {creating ? 'Posting...' : 'Share with Community'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />) :
         posts.length === 0 ? (
           <Card className="rounded-2xl border border-gray-100"><CardContent className="p-8 text-center">
             <UserIcon size={28} className="text-gray-300 mx-auto mb-2" />
             <p className="text-sm text-gray-400">No posts yet. Be the first to share!</p>
           </CardContent></Card>
         ) : posts.map((post) => (
           <motion.div key={post.post_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
             <Card className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow" data-testid={`post-${post.post_id}`}>
               <CardContent className="p-4">
                 <div className="flex items-center gap-2 mb-2.5">
                   <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                     <UserIcon size={14} className="text-green-600" />
                   </div>
                   <div className="flex-1">
                     <p className="text-sm font-semibold text-gray-900">{post.user_name || 'Farmer'}</p>
                     <div className="flex items-center gap-1"><Clock size={10} className="text-gray-300" /><span className="text-[10px] text-gray-400">{timeAgo(post.created_at)}</span></div>
                   </div>
                   <Badge className={`text-[10px] capitalize ${catColors[post.category] || catColors.general}`}>{post.category}</Badge>
                 </div>
                 <h3 className="font-semibold text-sm text-gray-900 mb-0.5">{post.title}</h3>
                 <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">{post.content}</p>
                 <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
                   <button data-testid={`like-${post.post_id}`} onClick={() => likePost(post.post_id)}
                     className={`flex items-center gap-1.5 text-xs transition-colors ${post.liked_by?.includes(user?.user_id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
                     <Heart size={14} fill={post.liked_by?.includes(user?.user_id) ? 'currentColor' : 'none'} /> {post.likes || 0}
                   </button>
                   <span className="flex items-center gap-1.5 text-xs text-gray-400"><MessageCircle size={14} /> {post.comments?.length || 0}</span>
                 </div>
               </CardContent>
             </Card>
           </motion.div>
         ))
        }
      </div>
    </div>
  );
}
