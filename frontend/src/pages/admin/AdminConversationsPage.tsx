import { useState } from 'react';
import api from '../../services/api';
import type { User, Conversation, Message } from '../../types';
import { Avatar } from '../../components/Avatar';
import { formatPhone, relativeTime } from '../../utils';
import { Search, X } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminConversationsPage() {
  const [searchUserId, setSearchUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Message[] | null>(null);
  const [userConversations, setUserConversations] = useState<Conversation[] | null>(null);
  const [convMessages, setConvMessages] = useState<Message[] | null>(null);
  const [viewingConv, setViewingConv] = useState<Conversation | null>(null);

  async function loadUserConversations() {
    if (!searchUserId) return;
    setUserConversations(null);
    setConvMessages(null);
    try {
      const { data } = await api.get<{ items: Conversation[] }>(`/admin/users/${searchUserId}/conversations`);
      setUserConversations(data.items);
    } catch {}
  }

  async function viewConversation(conv: Conversation) {
    setViewingConv(conv);
    setConvMessages(null);
    try {
      const { data } = await api.get<{ items: Message[] }>(`/admin/conversations/${conv.id}/messages`, { params: { pageSize: 200 } });
      setConvMessages(data.items);
    } catch {}
  }

  async function searchMessages() {
    if (!searchQuery) return;
    setResults(null);
    try {
      const { data } = await api.get<{ items: Message[] }>('/admin/messages/search', { params: { q: searchQuery, pageSize: 100 } });
      setResults(data.items);
    } catch {}
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">گفتگوها و پیام‌ها</h1>

      {/* Search by user */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm mb-6">
        <h3 className="text-sm font-semibold mb-3">جستجو بر اساس شناسه کاربر</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            placeholder="شناسه کاربر (UUID)"
            dir="ltr"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg text-sm"
          />
          <button onClick={loadUserConversations} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">جستجو</button>
        </div>
        {userConversations && (
          <div className="mt-4">
            {userConversations.length === 0 ? (
              <p className="text-sm text-gray-500">گفتگویی یافت نشد.</p>
            ) : (
              <div className="space-y-2">
                {userConversations.map((c) => (
                  <button key={c.id} onClick={() => viewConversation(c)} className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-right">
                    <Avatar name={c.otherParticipant?.fullName} url={c.otherParticipant?.avatarUrl} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.otherParticipant?.fullName}</div>
                      <div className="text-xs text-gray-500 truncate">{c.lastMessagePreview || 'بدون پیام'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search messages */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm">
        <h3 className="text-sm font-semibold mb-3">جستجوی پیام</h3>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMessages()}
              placeholder="متن جستجو..."
              className="w-full pr-9 pl-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg text-sm"
            />
          </div>
          <button onClick={searchMessages} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">جستجو</button>
        </div>
        {results && (
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">نتیجه‌ای یافت نشد.</p>
            ) : (
              results.map((m) => (
                <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1 flex justify-between">
                    <span>{m.senderName}</span>
                    <span>{relativeTime(m.createdAt)}</span>
                  </div>
                  <div className="text-sm">{m.content}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Conversation messages modal */}
      {viewingConv && (
        <Modal onClose={() => { setViewingConv(null); setConvMessages(null); }} title="پیام‌های گفتگو">
          {convMessages === null ? (
            <div className="flex justify-center py-8"><div className="loader" /></div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {convMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">پیامی وجود ندارد.</p>
              ) : (
                [...convMessages].reverse().map((m) => (
                  <div key={m.id} className={`max-w-[80%] p-2 rounded text-sm bg-gray-100 dark:bg-gray-700`}>
                    {m.content && <div>{m.content}</div>}
                    {m.attachments.length > 0 && (
                      <div className="text-xs text-gray-500">📎 {m.attachments.length} فایل</div>
                    )}
                    <div className="text-[10px] text-gray-500 mt-1">{relativeTime(m.createdAt)} • {m.senderName}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
