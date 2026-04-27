import json, time, urllib.request, urllib.parse, urllib.error, base64, boto3

_secret_cache = {}

def get_spotify_creds():
    secret_name = __import__('os').environ['SECRET_NAME']
    if secret_name not in _secret_cache:
        client = boto3.client('secretsmanager')
        resp = client.get_secret_value(SecretId=secret_name)
        _secret_cache[secret_name] = json.loads(resp['SecretString'])
    return _secret_cache[secret_name]

def _b64(client_id, client_secret):
    return base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

def exchange_code(code, redirect_uri):
    creds = get_spotify_creds()
    data = urllib.parse.urlencode({'grant_type':'authorization_code','code':code,'redirect_uri':redirect_uri}).encode()
    req = urllib.request.Request('https://accounts.spotify.com/api/token', data=data,
        headers={'Authorization':f"Basic {_b64(creds['client_id'],creds['client_secret'])}",
                 'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def refresh_access_token(refresh_token):
    creds = get_spotify_creds()
    data = urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':refresh_token}).encode()
    req = urllib.request.Request('https://accounts.spotify.com/api/token', data=data,
        headers={'Authorization':f"Basic {_b64(creds['client_id'],creds['client_secret'])}",
                 'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def _api_get(path, access_token, params=None):
    url = f"https://api.spotify.com/v1{path}"
    if params: url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Authorization':f'Bearer {access_token}'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def _api_post(path, access_token, body):
    url = f"https://api.spotify.com/v1{path}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={'Authorization':f'Bearer {access_token}','Content-Type':'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get_me(access_token): return _api_get('/me', access_token)
def get_top_tracks(access_token, limit=50, time_range='medium_term'):
    return _api_get('/me/top/tracks', access_token, {'limit':limit,'time_range':time_range})
def get_top_artists(access_token, limit=20, time_range='medium_term'):
    return _api_get('/me/top/artists', access_token, {'limit':limit,'time_range':time_range})
def create_playlist(access_token, user_id, name, description=''):
    return _api_post(f'/users/{user_id}/playlists', access_token,
        {'name':name,'description':description,'public':False})
def add_tracks_to_playlist(access_token, playlist_id, track_uris):
    for chunk in [track_uris[i:i+100] for i in range(0,len(track_uris),100)]:
        _api_post(f'/playlists/{playlist_id}/tracks', access_token, {'uris':chunk})

def get_auth_url(client_id, redirect_uri, state=''):
    scopes = 'user-read-private user-read-email user-top-read playlist-modify-private playlist-modify-public'
    params = urllib.parse.urlencode({
        'client_id': client_id,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'scope': scopes,
        'state': state,
    })
    return f"https://accounts.spotify.com/authorize?{params}"

def ensure_fresh_token(user_record):
    expires_at = user_record.get('tokenExpiresAt', 0)
    if time.time() < expires_at - 60:
        return user_record['accessToken'], None
    refreshed = refresh_access_token(user_record['refreshToken'])
    new_expires = int(time.time()) + refreshed['expires_in']
    updates = {'accessToken':refreshed['access_token'],'tokenExpiresAt':new_expires}
    return refreshed['access_token'], updates
