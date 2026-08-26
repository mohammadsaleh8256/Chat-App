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
  const dotSize = Math.max(8, Math.floor(size * 0.28));
  return (
    <div
      className="relative flex-shrink-0 inline-flex"
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: url ? 'transparent' : colorForName(name) }}
      >
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-semibold" style={{ fontSize }}>
            {getInitials(name)}
          </span>
        )}
      </div>
      {showStatus && isOnline && (
        <span
          className="absolute rounded-full bg-[#25d366] border-2 border-white dark:border-gray-800"
          style={{
            width: dotSize,
            height: dotSize,
            bottom: -2,
            left: -2,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
          }}
        />
      )}
    </div>
  );
}

export default Avatar;
