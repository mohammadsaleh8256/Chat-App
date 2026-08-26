import { cn, formatPhone } from '../utils';

interface AvatarProps {
  name?: string;
  url?: string | null;
  size?: number;
  isOnline?: boolean;
  showStatus?: boolean;
}

const COLORS = ['#075E54', '#128C7E', '#25D366', '#34B7F1', '#5B6CFF', '#9B5DE5', '#F15BB5', '#FF6B6B', '#FFA500', '#9ACD32'];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorForName(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return COLORS[sum % COLORS.length];
}

export function Avatar({ name = '', url, size = 40, isOnline = false, showStatus = false }: AvatarProps) {
  const fontSize = Math.floor(size * 0.4);
  return (
    <div
      className="relative flex-shrink-0 rounded-full overflow-hidden inline-flex"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-semibold"
          style={{ backgroundColor: colorForName(name), fontSize }}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && isOnline && (
        <span
          className="absolute bottom-0 left-0 w-1/3 h-1/3 rounded-full border-2 border-white bg-[#25d366]"
          style={{ minWidth: 8, minHeight: 8 }}
        />
      )}
    </div>
  );
}

export default Avatar;
