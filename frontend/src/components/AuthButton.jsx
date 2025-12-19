import React, { useState } from 'react';
import axios from 'axios';
import Button from './ui/Button';

// Send cookies with requests (HttpOnly cookies for tokens)
axios.defaults.withCredentials = true;


// 配置后端 API 基础 URL
const API_BASE_URL = 'http://localhost:8000';

const AuthButton = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 开始授权流程
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 第一步：重定向到 FastAPI 的 /auth/login 端点
      // 该端点会进一步重定向到 osu! 授权页面
      window.location.href = `${API_BASE_URL}/auth/login`;
    } catch (err) {
      setError('重定向失败: ' + err.message);
      setLoading(false);
    }
  };


  // 处理授权回调（应在回调页面调用）
  const handleCallback = async () => {
    // 从 URL 参数中获取授权码
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (!code) {
      setError('未收到授权码');
      return;
    }

    try {
      setLoading(true);
      // 发送授权码到后端换取访问令牌 (后端会以 HttpOnly cookies 返回令牌)
      const response = await axios.get(`${API_BASE_URL}/auth/callback`, {
        params: { code },
        withCredentials: true,
      });

      if (response.data?.success) {
        // fetch user data now that cookies are set
        await fetchUserData();
        setError(null);
        // 清除 URL 中的授权码参数
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError('授权失败');
      }

    } catch (err) {
      setError('授权失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 获取用户信息（使用 HttpOnly cookie 中的 access_token）
  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/user`, {
        withCredentials: true,
      });
      
      setUserData(response.data);
      try { localStorage.setItem('osu_user', JSON.stringify(response.data)) } catch (e) {}
      setError(null);
    } catch (err) {
      // 如果未认证，尝试使用刷新令牌 endpoint 刷新一次
      if (err.response?.status === 401) {
        try {
          await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
          // retry
          const retry = await axios.get(`${API_BASE_URL}/api/user`, { withCredentials: true });
          setUserData(retry.data);
          try { localStorage.setItem('osu_user', JSON.stringify(retry.data)) } catch (e) {}
          setError(null);
          return;
        } catch (refreshErr) {
          // refresh failed — ensure logged out
          handleLogout();
          setError('Session expired, please log in again.');
          return;
        }
      }

      setError('获取用户信息失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 检查 URL 是否有授权码（用于回调页面）并尝试静默恢复会话
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      handleCallback();
    } else {
      // 尝试从服务端读取当前会话（如果 cookie 存在）
      fetchUserData();
    }
  }, []);

  // 略去本地 token 过期轮询：刷新由服务器端 cookie + /auth/refresh 处理（需要时会触发）

  // 刷新由后端 cookie-managed refresh 处理（见 fetchUserData 的自动重试）
  
  // 登出（调用后端清除 cookies）
  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
    try { localStorage.removeItem('osu_user') } catch (e) {}
    setUserData(null);
  };

  // Try to restore persisted user info for quick UI render while validating session
  React.useEffect(() => {
    const stored = localStorage.getItem('osu_user');
    if (stored) {
      try {
        setUserData(JSON.parse(stored));
      } catch (e) {
        try { localStorage.removeItem('osu_user') } catch (e) {}
      }
    }
  }, []);

  // Persist userData whenever it changes
  React.useEffect(() => {
    if (userData) {
      try {
        localStorage.setItem('osu_user', JSON.stringify(userData));
      } catch (e) {
        console.warn('Failed to persist osu_user', e);
      }
    }
  }, [userData]);

  // (old) 登出 removed - using async handleLogout above which calls server to clear cookies

  return (
    <div className="auth-container">

      {userData && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8 }}>
          {userData && (() => {
            const avatar = userData.avatar_url || userData.avatar || userData.avatarUrl || null;
            const username = userData.username || userData.name || null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {username && <div style={{ color: '#fff', fontWeight: 600 }}>{username}</div>}
                {avatar && <img src={avatar} alt={username ? `${username} avatar` : 'avatar'} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.9)' }} />}
              </div>
            )
          })()}

          <Button onClick={handleLogout} style={{ backgroundColor: '#ff4444', color: '#fff', width: '40px', height: '40px', padding: 0, borderRadius: '6px' }} className="flex items-center justify-center" aria-label="Logout" title="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
              <path d="M9 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
            </svg>
          </Button>
        </div>
      
      )
    }
      {loading && <p>加载中...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!userData ? (
        <button onClick={handleLogin} disabled={loading}>
          {loading ? '正在连接到 osu!...' : 'Login with osu!'}
        </button>
      ) : (
        <div>
          <div style={{ marginTop: '20px' }}>
            {/* logged in */}
          </div>
        </div>
      )}
      
    </div>
  );
};

export default AuthButton;