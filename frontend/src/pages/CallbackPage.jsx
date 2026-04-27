import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || '';
const CLIENT_ID = '7af80999d7544c798ef2526c451ac162';
const REDIRECT_URI = 'https://dcn82tlx35i8d.cloudfront.net/callback';

export default function CallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting to Spotify…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      navigate(`/?error=${error || 'unknown'}`);
      return;
    }

    const verifier = localStorage.getItem('pkce_verifier');
    if (!verifier) {
      navigate('/?error=missing_verifier');
      return;
    }

    // Exchange code for token directly from frontend
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    setStatus('Exchanging token…');
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
      .then(r => r.json())
      .then(async tokens => {
        if (tokens.error) throw new Error(tokens.error);

        // Get user profile
        const me = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }).then(r => r.json());

        // Store in localStorage
        localStorage.setItem('harmonia_user_id', me.id);
        localStorage.setItem('harmonia_display_name', me.display_name || me.id);
        localStorage.setItem('harmonia_image_url', me.images?.[0]?.url || '');
        localStorage.setItem('harmonia_access_token', tokens.access_token);
        localStorage.setItem('harmonia_refresh_token', tokens.refresh_token);

        // Save to our backend
        await fetch(`${API}/profile`, {
          method: 'GET',
          headers: {
            'X-User-Id': me.id,
            'X-Access-Token': tokens.access_token,
            'X-Refresh-Token': tokens.refresh_token,
          },
        }).catch(() => {});

        navigate('/dashboard');
      })
      .catch(e => {
        console.error(e);
        navigate(`/?error=${e.message}`);
      });
  }, [navigate]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d0d0d' }}>
      <div>
        <div className="spinner" />
        <p style={{ textAlign:'center', color:'#a0a0c0', marginTop: 16 }}>{status}</p>
      </div>
    </div>
  );
}
