import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { chatSocket } from '../services/socket';
import { useAuthStore } from '../stores/auth.store';
import type { Conversation, User } from '../types';
import { ConversationList } from '../components/ConversationList';
import { ChatWindow } from '../components/ChatWindow';
import { AnimatePresence, motion } from 'framer-motion';
import { formatPhone } from '../utils';
import { MessageSquarePlus, Shield, LogOut, Search } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export default function ChatPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const refreshTimerRef = useRef<any>(null);
  const selectedRef = useRef<Conversation | null>(null);
  const reloadTimerRef = useRef<any>(null);

  // Keep selectedRef in sync so loadConversations can read current selection
  // without depending on it (which would cause re-render loops).
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get<{ items: Conversation[] }>('/conversations');
      // Deduplicate by id (safety against any backend duplication bug)
      // and filter out conversations without an otherParticipant (orphaned/invalid)
      const seen = new Set<string>();
      const unique = data.items.filter((c) => {
        if (seen.has(c.id)) return false;
        if (!c.otherParticipant) return false;  // skip orphaned conversations
        seen.add(c.id);
        return true;
      });
      setConversations(unique);
      // Preserve selected conversation reference (re-load its data so unread count etc. update)
      const sel = selectedRef.current;
      if (sel) {
        const updated = unique.find((c) => c.id === sel.id);
        if (updated) {
          // If user is currently viewing this conversation, keep unread at 0
          selectedRef.current = { ...updated, unreadCount: 0 };
          setSelected({ ...updated, unreadCount: 0 });
        }
      }
    } catch {} finally { setLoading(false); }
  }, []);

  // Debounced reload — multiple socket events in quick succession only trigger one reload
  const debouncedReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => { loadConversations(); }, 500);
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
    // Connect socket if not already connected
    chatSocket.connect();

    // Subscribe to socket events for conversation updates (debounced to avoid spam)
    const offReceive = chatSocket.on('message:receive', debouncedReload);
    const offConvUpdated = chatSocket.on('conversation:updated', debouncedReload);
    const offOnline = chatSocket.on('user:online', debouncedReload);
    const offOffline = chatSocket.on('user:offline', debouncedReload);

    // Periodic refresh as a safety net (every 30s, not too frequent)
    refreshTimerRef.current = setInterval(loadConversations, 30_000);
    return () => {
      offReceive();
      offConvUpdated();
      offOnline();
      offOffline();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [loadConversations, debouncedReload]);

  useEffect(() => {
    if (!search.trim()) setFiltered(conversations);
    else {
      const s = search.trim().toLowerCase();
      setFiltered(conversations.filter(c =>
        c.otherParticipant?.fullName.toLowerCase().includes(s) ||
        c.lastMessagePreview?.toLowerCase().includes(s)
      ));
    }
  }, [search, conversations]);

  async function selectConversation(conv: Conversation) {
    setSelected(conv);
    setMobileShowChat(true);
    chatSocket.emit('conversation:join', { conversationId: conv.id });
    try { await api.post(`/conversations/${conv.id}/read`); } catch {}
    loadConversations();
  }

  async function handleLogout() {
    await chatSocket.disconnect();
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <aside className={`w-full md:w-80 flex flex-col bg-white dark:bg-gray-800 border-l dark:border-gray-700 ${mobileShowChat && selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="bg-primary text-white p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={user?.fullName} url={user?.avatarUrl} size={36} />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{user?.fullName}</div>
              <div className="text-xs opacity-80 truncate" dir="ltr">{user && formatPhone(user.phoneNumber)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => navigate('/app/new')} className="p-2 rounded-full hover:bg-white/10" title="گفتگوی جدید">
              <MessageSquarePlus size={20} />
            </button>
            {user?.role === 'ADMIN' && (
              <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-white/10 text-yellow-300" title="پنل مدیر">
                <Shield size={18} />
              </button>
            )}
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-white/10" title="خروج">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی گفتگوها..."
              className="w-full pr-9 pl-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <ConversationList
          conversations={filtered}
          loading={loading}
          selectedId={selected?.id}
          onSelect={selectConversation}
        />
      </aside>

      {/* Chat Window */}
      <main className={`flex-1 flex flex-col overflow-hidden ${!mobileShowChat || !selected ? 'hidden md:flex' : 'flex'}`}>
        <AnimatePresence mode="wait">
          {selected ? (
            <ChatWindow
              key={selected.id}
              conversation={selected}
              currentUser={user!}
              onBack={() => { setMobileShowChat(false); setSelected(null); }}
            />
          ) : (
            <motion.div
              key="empty"
              className="flex-1 flex flex-col items-center justify-center text-center p-8 chat-bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-gray-400 mb-3">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M12 2C6.5 2 2 6 2 11c0 1.8.6 3.5 1.6 5L2 22l6-1.6c1.5.7 3 1 4.5 1 5.5 0 10-4 10-9S17.5 2 12 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">گفتگویی انتخاب نشده</h2>
              <p className="text-sm text-gray-500 max-w-xs">برای شروع یک گفتگوی جدید روی دکمه + بزنید یا از لیست گفتگوها یکی را انتخاب کنید.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
