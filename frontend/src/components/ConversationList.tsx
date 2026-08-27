import type { Conversation } from '../types';
import { Avatar } from './Avatar';
import { relativeTime } from '../utils';

interface Props {
  conversations: Conversation[];
  loading: boolean;
  selectedId?: string;
  onSelect: (c: Conversation) => void;
}

export function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>گفتگویی وجود ندارد.</p>
        <p className="text-xs mt-2">برای شروع یک گفتگوی جدید روی دکمه + بزنید.</p>
      </div>
    );
  }
  return (
    <div>
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-right border-b dark:border-gray-700 ${
            selectedId === c.id ? 'bg-gray-100 dark:bg-gray-700' : ''
          }`}
        >
          <Avatar
            name={c.otherParticipant?.fullName}
            url={c.otherParticipant?.avatarUrl}
            size={48}
            isOnline={c.otherParticipant?.isOnline}
            showStatus
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {c.otherParticipant?.fullName || 'بدون نام'}
              </span>
              {c.lastMessageAt && (
                <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(c.lastMessageAt)}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 truncate flex-1">
                {c.lastMessagePreview || 'گفتگو را شروع کنید'}
              </span>
              {c.unreadCount > 0 && (
                <span className="bg-accent text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center">
                  {c.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
