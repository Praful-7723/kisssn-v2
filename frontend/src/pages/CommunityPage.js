import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, MessageCircle, Plus, Send, User as UserIcon, Clock } from 'lucide-react';
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
    try {
      const res = await fetch(`${API}/community/posts`, { credentials: 'include' });
      if (res.ok) setPosts(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadPosts(); }, []);

  const createPost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/community/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle, content: newContent, category: newCategory })
      });
      if (res.ok) {
        toast.success('Post created');
        setNewTitle('');
        setNewContent('');
        setShowCreate(false);
        loadPosts();
      }
    } catch { toast.error('Failed to create post'); }
    finally { setCreating(false); }
  };

  const likePost = async (postId) => {
    try {
      const res = await fetch(`${API}/community/posts/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p =>
          p.post_id === postId
            ? { ...p, likes: data.liked ? p.likes + 1 : p.likes - 1, liked_by: data.liked ? [...(p.liked_by||[]), user?.user_id] : (p.liked_by||[]).filter(id => id !== user?.user_id) }
            : p
        ));
      }
    } catch {}
  };

  const categories = ['general', 'crops', 'pest', 'market', 'irrigation', 'soil'];
  const categoryColors = {
    general: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    crops: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pest: 'bg-red-500/10 text-red-400 border-red-500/20',
    market: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    irrigation: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    soil: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  return (
    <div className="p-4 space-y-5" data-testid="community-page">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-white">Community</h1>
          <p className="text-xs text-slate-500">Connect with fellow farmers</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button data-testid="create-post-btn" className="h-9 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-semibold gap-1.5 px-4">
              <Plus size={14} /> Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#12192B] border-white/10 max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="text-white font-['Outfit']">Create Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input
                data-testid="post-title-input"
                placeholder="Title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="rounded-xl bg-slate-950/50 border-white/10 text-white placeholder:text-slate-600"
              />
              <Textarea
                data-testid="post-content-input"
                placeholder="Share your question or knowledge..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className="rounded-xl bg-slate-950/50 border-white/10 text-white placeholder:text-slate-600 min-h-[100px]"
              />
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${
                      newCategory === cat ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-slate-500 border border-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Button
                data-testid="submit-post-btn"
                onClick={createPost}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold"
              >
                {creating ? 'Posting...' : 'Share with Community'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts Feed */}
      <div className="space-y-3">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))
        ) : posts.length === 0 ? (
          <Card className="glass rounded-2xl">
            <CardContent className="p-8 text-center">
              <UserIcon size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <motion.div
              key={post.post_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass rounded-2xl hover:border-white/15 transition-all" data-testid={`post-${post.post_id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/30 to-red-600/30 flex items-center justify-center">
                      <UserIcon size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{post.user_name || 'Farmer'}</p>
                      <div className="flex items-center gap-2">
                        <Clock size={10} className="text-slate-600" />
                        <span className="text-[10px] text-slate-600">{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    <Badge className={`text-[10px] capitalize ${categoryColors[post.category] || categoryColors.general}`}>
                      {post.category}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-1">{post.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-3">{post.content}</p>
                  <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                    <button
                      data-testid={`like-${post.post_id}`}
                      onClick={() => likePost(post.post_id)}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        post.liked_by?.includes(user?.user_id) ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
                      }`}
                    >
                      <Heart size={14} fill={post.liked_by?.includes(user?.user_id) ? 'currentColor' : 'none'} />
                      {post.likes || 0}
                    </button>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MessageCircle size={14} />
                      {post.comments?.length || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
