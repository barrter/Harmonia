import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const API = process.env.REACT_APP_API_URL || '';

function Nav({ onLogout }) {
  const name  = localStorage.getItem('harmonia_display_name') || '';
  const image = localStorage.getItem('harmonia_image_url')    || '';
  return (
    <nav>
      <span className="nav-logo">♫ Harmonia</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {image
          ? <img src={image} alt={name} className="avatar" />
          : <div className="avatar">{name[0]?.toUpperCase()}</div>}
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{name}</span>
        <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [groups,  setGroups]    = useState([]);
  const [newName, setNewName]   = useState('');
  const [joinId,  setJoinId]    = useState('');
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [synced,  setSynced]    = useState(false);
  const [err,     setErr]       = useState('');

  useEffect(() => {
    Promise.all([api.getProfile(), api.listGroups()])
      .then(([p, g]) => { setProfile(p); setGroups(g.groups || []); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.clear();
    navigate('/');
  }

  async function syncSpotify() {
    const token = localStorage.getItem('harmonia_access_token');
    const userId = localStorage.getItem('harmonia_user_id');
    if (!token) { setErr('No token — please log out and back in'); return; }
    setSyncing(true); setErr('');
    try {
      const res = await fetch(API + '/profile/spotify-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ accessToken: token, useRecentlyPlayed: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSynced(true);
      window.location.reload();
    } catch(e) {
      setErr('Sync failed — try logging out and back in');
    } finally { setSyncing(false); }
  }

  async function createGroup() {
    if (!newName.trim()) return;
    try {
      const g = await api.createGroup(newName.trim());
      navigate('/group/' + g.groupId);
    } catch (e) { setErr(e.message); }
  }

  async function leaveGroup(groupId, e) {
    e.stopPropagation();
    if (!window.confirm('Leave this group?')) return;
    try {
      const res = await fetch(`${API}/groups/${groupId}/leave`, {
        method: 'POST',
        headers: { 'X-User-Id': localStorage.getItem('harmonia_user_id') }
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await api.listGroups();
      setGroups(updated.groups || []);
    } catch(e) { setErr(e.message); }
  }

  async function joinGroup() {
    const id = joinId.trim().toUpperCase();
    if (!id) return;
    try {
      await api.joinGroup(id);
      navigate('/group/' + id);
    } catch (e) { setErr(e.message); }
  }

  if (loading) return <><Nav onLogout={logout} /><div className="spinner" /></>;

  return (
    <>
      <Nav onLogout={logout} />
      <div className="page">
        {err && <div className="error-banner">{err}</div>}

        {profile && (
          <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {profile.imageUrl
                ? <img src={profile.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                : <div className="avatar" style={{ width: 64, height: 64, fontSize: 28 }}>{profile.displayName?.[0]}</div>}
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.displayName}</div>
                <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
                  {profile.topTrackIds?.length || 0} top tracks · {profile.topArtistIds?.length || 0} top artists
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {(profile.genres || []).slice(0, 5).map(g => (
                    <span key={g} style={{
                      background: 'rgba(124,58,237,.2)', border: '1px solid rgba(124,58,237,.35)',
                      borderRadius: 20, padding: '2px 10px', fontSize: 12, color: 'var(--purple-l)',
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn-green" style={{ fontSize: 13, padding: '10px 20px', whiteSpace: 'nowrap', background: synced ? '#059669' : '' }} onClick={syncSpotify} disabled={syncing || synced}>
              {syncing ? '⏳ Syncing…' : synced ? '✓ Synced' : '🎵 Sync Spotify'}
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <div className="card">
            <div className="section-title" style={{ fontSize: 16 }}>Create a group</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <input placeholder="Group name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} />
              <button className="btn-primary" onClick={createGroup} style={{ whiteSpace: 'nowrap' }}>Create</button>
            </div>
          </div>
          <div className="card">
            <div className="section-title" style={{ fontSize: 16 }}>Join a group</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <input placeholder="Group code (e.g. A3F7C2)…" value={joinId} onChange={e => setJoinId(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinGroup()} style={{ textTransform: 'uppercase', letterSpacing: 2 }} />
              <button className="btn-primary" onClick={joinGroup} style={{ whiteSpace: 'nowrap' }}>Join</button>
            </div>
          </div>
        </div>

        <div className="section-title">Your Groups</div>
        {groups.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '48px 0', fontSize: 15 }}>
            No groups yet. Create one above or share a group code with friends.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map(g => (
              <div key={g.groupId} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => navigate('/group/' + g.groupId)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{g.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                    Code: <span style={{ fontFamily: 'monospace', color: 'var(--purple-l)', letterSpacing: 2 }}>{g.groupId}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', color: 'var(--muted)' }} onClick={(e) => leaveGroup(g.groupId, e)}>Leave</button>
                <button className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>Open →</button>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
