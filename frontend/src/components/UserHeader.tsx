import { useEffect, useState } from 'react';
import axios from 'axios';

interface UserInfo {
  id: number;
  username: string;
  avatar_url: string;
}

axios.defaults.withCredentials = true;

export function UserHeader() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('http://localhost:8000/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Not authenticated:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:8000/auth/logout');
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 flex items-center gap-3 bg-[#2a2a4e] rounded-lg px-4 py-2 z-50">
      <img
        src={user.avatar_url || `https://a.ppy.sh/${user.id}`}
        alt={user.username}
        className="w-10 h-10 rounded-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://osu.ppy.sh/images/layout/avatar-guest.png';
        }}
      />
      <span className="text-white font-semibold">{user.username}</span>
      <button
        onClick={handleLogout}
        className="bg-[#e74c3c] hover:bg-[#c0392b] text-white px-3 py-1 rounded transition-colors text-sm"
      >
        Logout
      </button>
    </div>
  );
}
