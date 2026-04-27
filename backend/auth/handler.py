import os, sys, json, time, urllib.parse
sys.path.insert(0, '/opt/python')
from spotify import get_auth_url, exchange_code, get_me, get_spotify_creds
from db import put_user, ok, err, cors_headers, log_event

def lambda_handler(event, context):
    path = event.get('path', '')
    qs   = event.get('queryStringParameters') or {}
    if '/login' in path:   return handle_login(qs)
    if '/callback' in path: return handle_callback(qs)
    if '/save' in path: return handle_save(event)
    return err('Not found', 404)

def handle_login(qs):
    creds = get_spotify_creds()
    url = get_auth_url(creds['client_id'], os.environ['REDIRECT_URI'], qs.get('state',''))
    log_event('auth_login_redirect')
    return {'statusCode':302,'headers':{'Location':url,**cors_headers()},'body':''}

def handle_callback(qs):
    code  = qs.get('code')
    error = qs.get('error')
    frontend_url = os.environ.get('FRONTEND_URL','')
    if error or not code:
        return {'statusCode':302,'headers':{'Location':frontend_url+'/?error=access_denied'},'body':''}
    try:
        tokens  = exchange_code(code, os.environ['REDIRECT_URI'])
        access  = tokens['access_token']
        refresh = tokens.get('refresh_token','')
        expires = int(time.time()) + tokens['expires_in']
        me = get_me(access)
        user_id = me['id']
        put_user(user_id, {
            'displayName':    me.get('display_name', user_id),
            'email':          me.get('email',''),
            'imageUrl':       (me.get('images') or [{}])[0].get('url',''),
            'accessToken':    access,
            'refreshToken':   refresh,
            'tokenExpiresAt': expires,
            'topTrackIds':    [],
            'topArtistIds':   [],
            'topArtistNames': [],
            'genres':         [],
            'updatedAt':      int(time.time()),
        })
        log_event('auth_success', user_id=user_id)
        params = urllib.parse.urlencode({'userId':user_id,'displayName':me.get('display_name',user_id),'imageUrl':(me.get('images') or [{}])[0].get('url','')})
        return {'statusCode':302,'headers':{'Location':frontend_url+'/dashboard?'+params},'body':''}
    except Exception as exc:
        log_event('auth_callback_exception', error=str(exc))
        return {'statusCode':302,'headers':{'Location':frontend_url+'/?error=auth_failed'},'body':''}

def handle_save(event):
    try:
        body = json.loads(event.get('body') or '{}')
        user_id = body.get('userId') or (event.get('headers') or {}).get('X-User-Id','')
        if not user_id:
            return err('Missing userId', 400)
        put_user(user_id, {
            'displayName':    body.get('displayName', user_id),
            'email':          body.get('email',''),
            'imageUrl':       body.get('imageUrl',''),
            'accessToken':    body.get('accessToken',''),
            'refreshToken':   body.get('refreshToken',''),
            'tokenExpiresAt': int(time.time()) + int(body.get('expiresIn', 3600)),
            'topTrackIds':    [],
            'topArtistIds':   [],
            'topArtistNames': [],
            'genres':         [],
            'updatedAt':      int(time.time()),
        })
        log_event('auth_save', user_id=user_id)
        return ok({'message': 'User saved', 'userId': user_id})
    except Exception as e:
        return err(str(e), 500)
