import sys
import time

sys.path.insert(0, '/opt/python')
from spotify import get_top_tracks, get_top_artists, ensure_fresh_token
from db import get_user, update_user, ok, err, get_user_id, log_event


def lambda_handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return err('Missing X-User-Id header', 401)

    user = get_user(user_id)
    if not user:
        return err('User not found — please log in again', 404)

    path = event.get('path', '')

    if 'spotify-refresh' in path:
        return spotify_refresh(user_id, event)
    if 'refresh' in path:
        return refresh_profile(user_id, user)

    safe = {k: v for k, v in user.items()
            if k not in ('accessToken', 'refreshToken', 'tokenExpiresAt')}
    log_event('profile_get', user_id=user_id)
    return ok(safe)


def spotify_refresh(user_id, event):
    import json, time, urllib.request
    body = json.loads(event.get('body') or '{}')
    token = body.get('accessToken', '')
    if not token:
        return err('Missing accessToken', 400)
    try:
        def sp_get(path):
            req = urllib.request.Request(
                f"https://api.spotify.com/v1{path}",
                headers={"Authorization": f"Bearer {token}"}
            )
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read())

        tracks = sp_get("/me/top/tracks?limit=50&time_range=medium_term")
        artists = sp_get("/me/top/artists?limit=20&time_range=medium_term")

        track_ids = [t["id"] for t in tracks.get("items", [])]
        track_names = [t["name"] for t in tracks.get("items", [])]
        track_artists = [t["artists"][0]["name"] for t in tracks.get("items", [])]
        artist_ids = [a["id"] for a in artists.get("items", [])]
        artist_names = [a["name"] for a in artists.get("items", [])]
        genres = list({g for a in artists.get("items", []) for g in a.get("genres", [])})

        update_user(user_id, {
            'topTrackIds': track_ids,
            'topTrackNames': track_names,
            'topTrackArtists': track_artists,
            'topArtistIds': artist_ids,
            'topArtistNames': artist_names,
            'genres': genres,
            'updatedAt': int(time.time()),
        })

        log_event('spotify_refresh', user_id=user_id,
                  track_count=len(track_ids), artist_count=len(artist_ids))
        return ok({'message': 'Refreshed!', 'trackCount': len(track_ids), 'artistCount': len(artist_ids)})

    except Exception as e:
        return err(f'Spotify error: {str(e)}', 400)


def refresh_profile(user_id, user):
    access, token_updates = ensure_fresh_token(user)
    if token_updates:
        update_user(user_id, token_updates)
        user.update(token_updates)

    top_tracks  = get_top_tracks(access, limit=50)
    top_artists = get_top_artists(access, limit=20)

    track_ids   = [t['id'] for t in top_tracks.get('items', [])]
    artist_ids  = [a['id'] for a in top_artists.get('items', [])]
    genres      = list({g for a in top_artists.get('items', []) for g in a.get('genres', [])})

    updates = {
        'topTrackIds':    track_ids,
        'topArtistIds':   artist_ids,
        'topArtistNames': [a['name'] for a in top_artists.get('items', [])],
        'genres':         genres,
        'updatedAt':      int(time.time()),
    }
    update_user(user_id, updates)
    log_event('profile_refresh', user_id=user_id, track_count=len(track_ids))
    return ok({'message': 'Profile refreshed', **updates})
