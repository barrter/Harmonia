import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

function PieChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: ['#7C3AED', '#1DB954', '#3B82F6'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw}pts`
            }
          }
        }
      }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 200 }}>
      <canvas ref={canvasRef} role="img" aria-label="Compatibility breakdown pie chart" />
    </div>
  );
}

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
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    if (window.Chart) { setChartLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setChartLoaded(true);
    document.head.appendChild(script);
  }, []);

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

  if (loading) return (<><nav><span className="nav-logo">Harmonia</span></nav><div className="spinner"/></>);

  const members = group?.membersInfo || [];
  const me = members.find(m => m.userId === myId) || members[0] || {};
  const other = members.find(m => m.userId !== myId) || members[1] || {};

  const myTracks = new Set(me.topTrackIds || []);
  const otherTracks = new Set(other.topTrackIds || []);
  const myArtists = new Set(me.topArtistIds || []);
  const otherArtists = new Set(other.topArtistIds || []);
  const myGenres = new Set(me.genres || []);
  const otherGenres = new Set(other.genres || []);

  const sharedArtistNames = (me.topArtistNames || []).filter(n => (other.topArtistNames || []).includes(n));
  const sharedGenres = [...myGenres].filter(x => otherGenres.has(x));
  const sharedTrackIds = new Set([...myTracks].filter(x => otherTracks.has(x)));

  // Jaccard similarity — matches backend algorithm exactly
  const breakdown = scores?.pairScores?.[0]?.breakdown || null;
  const artistScore = breakdown ? breakdown.artistScore : 0;
  const genreScore = breakdown ? breakdown.genreScore : 0;
  const trackScore = breakdown ? breakdown.trackScore : 0;
  const artistShared = breakdown ? breakdown.artistShared : sharedArtistNames.length;
  const artistTotal = breakdown ? breakdown.artistTotal : new Set([...myArtists, ...otherArtists]).size;
  const genreShared = breakdown ? breakdown.genreShared : sharedGenres.length;
  const genreTotal = breakdown ? breakdown.genreTotal : new Set([...(me.genres||[]), ...(other.genres||[])]).size;
  const trackShared = breakdown ? breakdown.trackShared : sharedTrackIds.size;
  const trackTotal = breakdown ? breakdown.trackTotal : new Set([...myTracks, ...otherTracks]).size;
  const groupScore = scores?.groupScore;

  // Group tracks by artist — top 4 artists, up to 4 songs each
  function groupByArtist(member, excludeSet, limit = 4) {
    const ids = member.topTrackIds || [];
    const names = member.topTrackNames || [];
    const artists = member.topTrackArtists || [];
    const artistMap = {};
    ids.forEach((tid, i) => {
      if (excludeSet && excludeSet.has(tid)) return;
      const artist = artists[i] || 'Unknown';
      if (!artistMap[artist]) artistMap[artist] = [];
      if (artistMap[artist].length < 10) artistMap[artist].push(names[i] || `Track ${i+1}`);
    });
    return Object.entries(artistMap).slice(0, 8);
  }

  function sharedGrouped() {
    const ids = me.topTrackIds || [];
    const names = me.topTrackNames || [];
    const artists = me.topTrackArtists || [];
    const artistMap = {};
    ids.forEach((tid, i) => {
      if (!sharedTrackIds.has(tid)) return;
      const artist = artists[i] || 'Unknown';
      if (!artistMap[artist]) artistMap[artist] = [];
      if (artistMap[artist].length < 10) artistMap[artist].push(names[i] || `Track ${i+1}`);
    });
    return Object.entries(artistMap).slice(0, 4);
  }

  const SECTION = ({ title, color, groups }) => (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>{title}</div>
      {groups.length === 0
        ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>None</div>
        : groups.map(([artist, tracks]) => (
          <div key={artist} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{artist}</div>
            {tracks.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '3px 0 3px 10px', borderLeft: `2px solid ${color}30` }}>{t}</div>
            ))}
          </div>
        ))
      }
    </div>
  );

  return (
    <>
      <nav>
        <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => navigate('/dashboard')}>Back</button>
        <span className="nav-logo">Harmonia</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Code:</span>
          <span style={{ fontFamily: 'monospace', color: 'var(--purple-l)', letterSpacing: 3, fontWeight: 700 }}>{id}</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={copyCode}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </nav>

      <div className="page">
        {err && <div className="error-banner">{err}</div>}

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>{group?.name}</h1>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {members.length} members — code <span style={{ fontFamily: 'monospace', color: 'var(--purple-l)', letterSpacing: 2 }}>{id}</span>
          </div>
        </div>

        {/* Top row: pie + stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24 }}>
          <div className="card">
            {!scores ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>Compare music taste</div>
                <button className="btn-primary" onClick={computeScores} disabled={scoring || members.length < 2} style={{ padding: '10px 24px' }}>
                  {scoring ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
            ) : (
              <>
                {chartLoaded && <PieChart data={[
                  { label: `Artists (${artistScore}/40pts)`, value: Math.max(artistScore, 0.5) },
                  { label: `Genres (${genreScore}/30pts)`, value: Math.max(genreScore, 0.5) },
                  { label: `Tracks (${trackScore}/30pts)`, value: Math.max(trackScore, 0.5) },
                ]} />}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: groupScore >= 70 ? '#1db954' : groupScore >= 40 ? 'var(--purple-l)' : '#f59e0b' }}>{groupScore}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>out of 100</div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  {[
                    ['#7C3AED', 'Artists', artistScore, 60, artistShared, artistTotal],
                    ['#1DB954', 'Genres', genreScore, 10, genreShared, genreTotal],
                    ['#3B82F6', 'Tracks', trackScore, 30, trackShared, trackTotal],
                  ].map(([c, l, score, max, shared, total]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      {l}: {shared}/{total} = {score}/{max}pts
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(m => (
              <div key={m.userId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar">{m.displayName?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{m.displayName} {m.userId === myId && <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 400 }}>you</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{(m.topTrackIds || []).length} tracks · {(m.topArtistIds || []).length} artists</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {(m.topArtistNames || []).slice(0, 5).map(n => (
                      <span key={n} style={{
                        background: sharedArtistNames.includes(n) ? 'rgba(29,185,84,.12)' : 'rgba(124,58,237,.12)',
                        borderRadius: 4, padding: '2px 8px', fontSize: 11,
                        color: sharedArtistNames.includes(n) ? '#1db954' : 'var(--purple-l)',
                      }}>{n}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {scores && (
              <div className="card">
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Shared genres</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sharedGenres.map(g => (
                    <span key={g} style={{ background: 'rgba(29,185,84,.12)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#1db954' }}>{g}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Songs section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Songs</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <SECTION title="Both listen to" color="#1DB954" groups={sharedGrouped()} />
            <SECTION title={`Only ${me.displayName || 'you'}`} color="#7C3AED" groups={groupByArtist(me, sharedTrackIds)} />
            <SECTION title={`Only ${other.displayName || 'them'}`} color="#F59E0B" groups={groupByArtist(other, sharedTrackIds)} />
          </div>
        </div>

        {/* Playlist */}
        <div className="card">
          {playlist?.exportSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{playlist.playlistName}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{playlist.trackCount} tracks exported to Spotify</div>
              <a href={playlist.spotifyUrl} target="_blank" rel="noreferrer">
                <button className="btn-green" style={{ padding: '10px 28px' }}>Open in Spotify</button>
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Generate Playlist</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ranks tracks by group overlap and exports to Spotify</div>
              </div>
              <input value={playName} onChange={e => setPlayName(e.target.value)} style={{ width: 200 }} />
              <button className="btn-green" onClick={generatePlaylist} disabled={generating || members.length < 2} style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}>
                {generating ? 'Generating...' : 'Generate & Export'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
