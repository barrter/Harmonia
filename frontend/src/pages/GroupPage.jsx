import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const myId = localStorage.getItem('harmonia_user_id');
  const [group, setGroup] = useState(null);
  const [scores, setScores] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [playName, setPlayName] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    try { const g = await api.getGroup(id); setGroup(g); setPlayName(`Harmonia: ${g.name}`); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function computeScores() {
    setScoring(true); setErr('');
    try { setScores(await api.getScores(id)); }
    catch (e) { setErr(e.message); }
    finally { setScoring(false); }
  }

  async function generatePlaylist() {
    setGenerating(true); setErr('');
    try { setPlaylist(await api.generatePlaylist(id, { name: playName || undefined, maxTracks: 30 })); }
    catch (e) { setErr(e.message); }
    finally { setGenerating(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (<><nav><span className="nav-logo">♫ Harmonia</span></nav><div className="spinner"/></>);

  const members = group?.membersInfo || [];
  const me = members.find(m => m.userId === myId) || members[0] || {};
  const other = members.find(m => m.userId !== myId) || members[1] || {};

  const myTracks = new Set(me.topTrackIds || []);
  const otherTracks = new Set(other.topTrackIds || []);
  const myArtists = new Set(me.topArtistIds || []);
  const otherArtists = new Set(other.topArtistIds || []);
  const myGenres = new Set(me.genres || []);
  const otherGenres = new Set(other.genres || []);

  const sharedTrackIds = [...myTracks].filter(x => otherTracks.has(x));
  const sharedArtistNames = (me.topArtistNames || []).filter(n => (other.topArtistNames || []).includes(n));
  const sharedGenres = [...myGenres].filter(x => otherGenres.has(x));

  const groupScore = scores?.groupScore;

  // Build track list with names
  const buildTrackList = (member) => {
    const ids = member.topTrackIds || [];
    const names = member.topTrackNames || [];
    const artists = member.topTrackArtists || [];
    return ids.map((id, i) => ({
      id, name: names[i] || `Track ${i+1}`, artist: artists[i] || '',
      shared: otherTracks.has(id) || myTracks.has(id)
    }));
  };

  const myTrackList = buildTrackList(me);
  const otherTrackList = buildTrackList(other);
  const sharedTrackList = myTrackList.filter(t => otherTracks.has(t.id));

  const scoreColor = (s) => s >= 70 ? '#1db954' : s >= 40 ? '#9d5cf6' : '#f59e0b';

  return (
    <>
      <nav>
        <button className="btn-ghost" style={{fontSize:13,padding:'6px 14px'}} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <span className="nav-logo">♫ Harmonia</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'var(--muted)',fontSize:13}}>Code:</span>
          <span style={{fontFamily:'monospace',color:'var(--purple-l)',letterSpacing:3,fontWeight:700}}>{id}</span>
          <button className="btn-ghost" style={{fontSize:12,padding:'5px 12px'}} onClick={copyCode}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      </nav>

      <div className="page">
        {err && <div className="error-banner">{err}</div>}

        {/* ── DASHBOARD HEADER ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:16,marginBottom:28}}>
          <div className="card" style={{textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>GROUP</div>
            <div style={{fontSize:22,fontWeight:900,color:'var(--text)'}}>{group?.name}</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{members.length} members</div>
          </div>
          <div className="card" style={{textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>COMPATIBILITY</div>
            {groupScore !== undefined
              ? <div style={{fontSize:36,fontWeight:900,color:scoreColor(groupScore)}}>{groupScore}<span style={{fontSize:16,color:'var(--muted)'}}>/100</span></div>
              : <button className="btn-primary" style={{fontSize:12,padding:'8px 16px',marginTop:4}} onClick={computeScores} disabled={scoring}>
                  {scoring ? '…' : '🎯 Calculate'}
                </button>
            }
          </div>
          <div className="card" style={{textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>SHARED TRACKS</div>
            <div style={{fontSize:36,fontWeight:900,color:'var(--purple-l)'}}>{sharedTrackIds.length}</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>of {Math.max(myTracks.size, otherTracks.size)} total</div>
          </div>
          <div className="card" style={{textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>SHARED ARTISTS</div>
            <div style={{fontSize:36,fontWeight:900,color:'var(--green)'}}>{sharedArtistNames.length}</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>of {Math.max(myArtists.size, otherArtists.size)} total</div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'1px solid var(--border)',paddingBottom:0}}>
          {['overview','tracks','artists','playlist'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background:'none',border:'none',padding:'10px 20px',fontSize:14,fontWeight:600,
              color: tab===t ? 'var(--purple-l)' : 'var(--muted)',
              borderBottom: tab===t ? '2px solid var(--purple-l)' : '2px solid transparent',
              borderRadius:0, cursor:'pointer', textTransform:'capitalize'
            }}>{t}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {members.map(m => (
              <div key={m.userId} className="card">
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                  <div className="avatar" style={{width:48,height:48,fontSize:20}}>{m.displayName?.[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:17}}>{m.displayName} {m.userId===myId && <span style={{color:'var(--purple-l)',fontSize:12}}>you</span>}</div>
                    <div style={{color:'var(--muted)',fontSize:13}}>{m.trackCount || (m.topTrackIds||[]).length} tracks · {(m.topArtistNames||[]).length} artists</div>
                  </div>
                </div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Top Artists</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                  {(m.topArtistNames||[]).slice(0,6).map(n => {
                    const shared = sharedArtistNames.includes(n);
                    return <span key={n} style={{
                      background: shared ? 'rgba(29,185,84,.15)' : 'rgba(124,58,237,.15)',
                      border: `1px solid ${shared ? 'rgba(29,185,84,.3)' : 'rgba(124,58,237,.3)'}`,
                      borderRadius:20, padding:'3px 10px', fontSize:12,
                      color: shared ? '#1db954' : 'var(--purple-l)'
                    }}>{n}</span>;
                  })}
                </div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Genres</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {(m.genres||[]).slice(0,5).map(g => (
                    <span key={g} style={{background:'var(--surface)',borderRadius:20,padding:'2px 8px',fontSize:11,color:'var(--muted)'}}>{g}</span>
                  ))}
                </div>
              </div>
            ))}

            {/* Compatibility breakdown */}
            {groupScore !== undefined && (
              <div className="card" style={{gridColumn:'1/-1'}}>
                <div className="section-title" style={{fontSize:15,marginBottom:16}}>Compatibility Breakdown</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                  {[
                    {label:'🎤 Artist Overlap', val: Math.round(sharedArtistNames.length/Math.max(myArtists.size,otherArtists.size)*100), detail:`${sharedArtistNames.length} shared`},
                    {label:'🎵 Genre Overlap', val: Math.round(sharedGenres.length/Math.max(myGenres.size,otherGenres.size)*100), detail:`${sharedGenres.length} shared`},
                    {label:'🎶 Track Overlap', val: Math.round(sharedTrackIds.length/Math.max(myTracks.size,otherTracks.size)*100), detail:`${sharedTrackIds.length} shared`},
                  ].map(b => (
                    <div key={b.label} style={{textAlign:'center'}}>
                      <div style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>{b.label}</div>
                      <div style={{fontSize:32,fontWeight:900,color:'var(--purple-l)'}}>{b.val}%</div>
                      <div style={{fontSize:12,color:'var(--muted)'}}>{b.detail}</div>
                      <div style={{background:'var(--surface)',borderRadius:4,height:6,marginTop:8,overflow:'hidden'}}>
                        <div style={{width:`${b.val}%`,background:'var(--purple)',height:'100%',borderRadius:4,transition:'width .6s'}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:20}}>
                  <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Shared genres:</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {sharedGenres.map(g => <span key={g} style={{background:'rgba(29,185,84,.15)',border:'1px solid rgba(29,185,84,.3)',borderRadius:20,padding:'3px 10px',fontSize:12,color:'#1db954'}}>{g}</span>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRACKS TAB ── */}
        {tab === 'tracks' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Shared tracks */}
            <div className="card" style={{gridColumn:'1/-1'}}>
              <div className="section-title" style={{fontSize:15,marginBottom:4}}>🤝 Shared Tracks <span style={{color:'var(--muted)',fontWeight:400,fontSize:13}}>— both of you listen to these</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:12}}>
                {sharedTrackList.length === 0
                  ? <div style={{color:'var(--muted)',fontSize:14,textAlign:'center',padding:20}}>No shared tracks yet</div>
                  : sharedTrackList.map((t,i) => (
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,background: i%2===0 ? 'var(--surface)' : 'transparent'}}>
                      <div style={{width:24,textAlign:'center',color:'var(--muted)',fontSize:13}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{t.name}</div>
                        <div style={{fontSize:12,color:'var(--muted)'}}>{t.artist}</div>
                      </div>
                      <span style={{background:'rgba(29,185,84,.15)',border:'1px solid rgba(29,185,84,.3)',borderRadius:20,padding:'3px 10px',fontSize:11,color:'#1db954'}}>Shared ✓</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Each person's unique tracks */}
            {[{member: me, tracks: myTrackList, otherSet: otherTracks},
              {member: other, tracks: otherTrackList, otherSet: myTracks}].map(({member, tracks, otherSet}) => (
              <div key={member.userId} className="card">
                <div className="section-title" style={{fontSize:15,marginBottom:12}}>
                  Only {member.displayName}
                  {member.userId===myId && <span style={{color:'var(--purple-l)',fontSize:12,marginLeft:6}}>you</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  {tracks.filter(t => !otherSet.has(t.id)).slice(0,10).map((t,i) => (
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background: i%2===0 ? 'var(--surface)' : 'transparent'}}>
                      <div style={{width:20,textAlign:'center',color:'var(--muted)',fontSize:12}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{t.name}</div>
                        <div style={{fontSize:11,color:'var(--muted)'}}>{t.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ARTISTS TAB ── */}
        {tab === 'artists' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20}}>
            <div className="card">
              <div className="section-title" style={{fontSize:15,marginBottom:12,color:'#1db954'}}>🤝 Shared Artists</div>
              {sharedArtistNames.map((n,i) => (
                <div key={n} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom: i<sharedArtistNames.length-1 ? '1px solid var(--border)' : 'none'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(29,185,84,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#1db954'}}>{n[0]}</div>
                  <div style={{fontWeight:600,fontSize:14}}>{n}</div>
                </div>
              ))}
            </div>
            {[
              {member: me, names: (me.topArtistNames||[]).filter(n => !(other.topArtistNames||[]).includes(n)), color:'var(--purple-l)', bg:'rgba(124,58,237,.15)'},
              {member: other, names: (other.topArtistNames||[]).filter(n => !(me.topArtistNames||[]).includes(n)), color:'#f59e0b', bg:'rgba(245,158,11,.15)'},
            ].map(({member, names, color, bg}) => (
              <div key={member.userId} className="card">
                <div className="section-title" style={{fontSize:15,marginBottom:12,color}}>Only {member.displayName}</div>
                {names.map((n,i) => (
                  <div key={n} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom: i<names.length-1 ? '1px solid var(--border)' : 'none'}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color}}>{n[0]}</div>
                    <div style={{fontWeight:600,fontSize:14}}>{n}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── PLAYLIST TAB ── */}
        {tab === 'playlist' && (
          <div style={{maxWidth:600,margin:'0 auto'}}>
            {!scores && (
              <div className="card" style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:14,color:'var(--muted)',marginBottom:12}}>Calculate compatibility first to get the best playlist</div>
                <button className="btn-primary" onClick={computeScores} disabled={scoring}>{scoring ? 'Calculating…' : '🎯 Calculate Compatibility'}</button>
              </div>
            )}
            {playlist?.exportSuccess ? (
              <div className="card" style={{textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <div style={{fontWeight:800,fontSize:22,marginBottom:6}}>{playlist.playlistName}</div>
                <div style={{color:'var(--muted)',fontSize:14,marginBottom:20}}>{playlist.trackCount} tracks exported to Spotify</div>
                <a href={playlist.spotifyUrl} target="_blank" rel="noreferrer">
                  <button className="btn-green" style={{width:'100%',fontSize:16,padding:'14px 0'}}>Open in Spotify ↗</button>
                </a>
              </div>
            ) : (
              <div className="card">
                <div className="section-title" style={{fontSize:16,marginBottom:16}}>Generate Group Playlist</div>
                <input placeholder="Playlist name…" value={playName} onChange={e => setPlayName(e.target.value)} style={{marginBottom:12}}/>
                <p style={{color:'var(--muted)',fontSize:13,marginBottom:16}}>
                  Harmonia ranks every track by how many group members listen to it, then exports the top 30 directly to your Spotify library.
                </p>
                <button className="btn-green" onClick={generatePlaylist} disabled={generating||members.length<2} style={{width:'100%',fontSize:16,padding:'14px 0'}}>
                  {generating ? 'Generating…' : '🎵 Generate & Export to Spotify'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
