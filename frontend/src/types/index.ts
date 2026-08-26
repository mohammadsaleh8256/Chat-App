export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phoneNumber: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED' | 'DELETED';
  isOnline: boolean;
  lastSeen?: string | null;
  createdAt: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  phoneNumber: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeen?: string | null;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  title?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  otherParticipant?: UserSummary | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  originalFileName: string;
  size: string;
  mimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF' | 'ZIP' | 'RAR' | 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION' | 'TEXT' | 'OTHER';
  thumbnailUrl?: string | null;
  downloadUrl: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  replyToId?: string | null;
  replyToPreview?: string | null;
  forwardedFromId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  isEdited: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  attachments: Attachment[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface DashboardStats {
  totalUsers: number;
  onlineUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalAttachments: number;
  totalAttachmentSizeBytes: string;
  totalAdmins: number;
  disabledUsers: number;
  activeUploads: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId?: string | null;
  targetConversationId?: string | null;
  targetMessageId?: string | null;
  targetAttachmentId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface UploadInit {
  uploadId: string;
  attachmentId: string;
  chunkDirectory: string;
  chunkSize: number;
  canResume: boolean;
  receivedChunks: number;
}

export interface UploadStatus {
  uploadId: string;
  attachmentId: string;
  fileName: string;
  size: string;
  uploadedBytes: string;
  totalChunks: number;
  receivedChunks: number;
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  completedAt?: string | null;
}

export interface ApiError {
  error: string;
  message: string;
  detail?: string;
  traceId?: string;
  code?: string;
  statusCode: number;
  validationErrors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}
