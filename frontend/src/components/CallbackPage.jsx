import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const CallbackPage = () => {
  const [status, setStatus] = useState('处理授权中...');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const errorParam = urlParams.get('error');

      if (errorParam) {
        setError(`授权被拒绝: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code) {
        setError('未收到授权码');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        setStatus('正在验证授权码...');
        
        // 发送授权码到后端 (后端会通过 HttpOnly cookies 设置令牌)
        const response = await axios.get(`${API_BASE_URL}/auth/callback`, {
          params: { code },
          withCredentials: true,
        });
        console.log('Callback response:', response.data);
        if (response.data.success) {
          setStatus('授权成功！正在跳转...');
          setTimeout(() => navigate('/'), 2000);
        }
      } catch (err) {
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>{status}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>如果页面没有自动跳转，请<a href="/">点击这里</a>返回首页。</p>
    </div>
  );
};

export default CallbackPage;