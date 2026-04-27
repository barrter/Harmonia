import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CLIENT_ID = '7af80999d7544c798ef2526c451ac162';
const REDIRECT_URI = 'https://dcn82tlx35i8d.cloudfront.net/callback';

function generateVerifier() {
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('harmonia_user_id')) navigate('/dashboard');
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError(params.get('error'));
  }, [navigate]);

  async function handleConnect() {
    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);
    localStorage.setItem('pkce_verifier', verifier);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: 'user-read-private user-read-email user-top-read playlist-modify-private playlist-modify-public',
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg, #0d0d0d 0%, #1a0a2e 100%)'}}>
      <div style={{textAlign:'center',maxWidth:440,padding:'0 24px'}}>
        <div style={{fontSize:64,marginBottom:8}}>♫</div>
        <h1 style={{fontSize:52,fontWeight:900,color:'#fff',letterSpacing:-1}}>Harmonia</h1>
        <p style={{color:'#a0a0c0',fontSize:17,margin:'12px 0 40px',lineHeight:1.5}}>
          Group playlist generation powered by your real Spotify listening data.
        </p>
        {error ? (
          <div style={{background:'rgba(220,38,38,.15)',border:'1px solid rgba(220,38,38,.4)',borderRadius:8,color:'#fca5a5',padding:'12px 16px',marginBottom:24,fontSize:14}}>
            Authentication failed: {error}. Please try again.
          </div>
        ) : null}
        <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:36,flexWrap:'wrap'}}>
          <span className="pill">🎵 Real top-50 data</span>
          <span className="pill">🧠 AI compatibility score</span>
          <span className="pill">✅ Exports to Spotify</span>
        </div>
        <button className="btn-green" onClick={handleConnect} style={{width:'100%',fontSize:17,padding:'16px 0',borderRadius:50}}>
          Connect with Spotify
        </button>
        <p style={{color:'#a0a0c0',fontSize:13,marginTop:20,lineHeight:1.6}}>
          Harmonia reads your top tracks and artists (read-only). No data is sold or shared.
        </p>
      </div>
    </div>
  );
}
