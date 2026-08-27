import { Outlet } from 'react-router-dom';

export default function ChatLayout() {
  // ChatLayout is just a wrapper — the actual sidebar + chat window
  // are rendered by ChatPage via Outlet. This avoids duplicate sidebars.
  return <Outlet />;
}
