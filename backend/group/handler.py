import sys
import json
import time
import uuid

sys.path.insert(0, '/opt/python')
from db import (get_group, put_group, add_member_to_group, get_user,
                ok, err, get_user_id, log_event)


def lambda_handler(event, context):
    path = event.get('path', '')
    method = event.get('httpMethod', 'GET')
    if 'leave' in path and method == 'POST':
        return handle_leave(event)
    return handle_main(event)

def handle_leave(event):
    import boto3, os
    user_id = get_user_id(event)
    group_id = (event.get('pathParameters') or {}).get('groupId')
    if not user_id or not group_id:
        return err('Missing params', 400)
    region = os.environ.get('AWS_REGION', 'us-east-2')
    ddb = boto3.resource('dynamodb', region_name=region)
    groups_table = os.environ.get('GROUPS_TABLE', 'harmonia-groups-prod')
    users_table = os.environ.get('USERS_TABLE', 'harmonia-users-prod')
    # Remove user from group
    ddb.Table(groups_table).update_item(
        Key={'groupId': group_id},
        UpdateExpression='DELETE members :m',
        ExpressionAttributeValues={':m': {user_id}}
    )
    # Remove group from user
    try:
        ddb.Table(users_table).update_item(
            Key={'userId': user_id},
            UpdateExpression='DELETE groups :g',
            ExpressionAttributeValues={':g': {group_id}}
        )
    except Exception:
        pass
    log_event('group_leave', user_id=user_id, group_id=group_id)
    return ok({'message': 'Left group'})

def handle_main(event, context=None):
    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '')
    pp     = event.get('pathParameters') or {}

    if method == 'POST' and path.endswith('/groups'):
        return create_group(event)
    if method == 'GET' and path.endswith('/groups'):
        return list_user_groups(event)
    if method == 'GET' and 'groupId' in pp:
        return get_group_detail(pp['groupId'])
    if method == 'POST' and 'join' in path:
        return join_group(pp.get('groupId'), event)
    return err('Not found', 404)


def create_group(event):
    user_id = get_user_id(event)
    if not user_id:
        return err('Missing X-User-Id header', 401)

    user = get_user(user_id)
    if not user:
        return err('User not found', 404)

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    group_id = str(uuid.uuid4())[:8].upper()
    group = {
        'name':      body.get('name', f"{user.get('displayName', 'My')}'s Group"),
        'createdBy': user_id,
        'members':   {user_id},
        'createdAt': int(time.time()),
        'playlist':  None,
    }
    put_group(group_id, group)

    # Track groups on the user record
    from db import update_user, USERS
    USERS().update_item(
        Key={'userId': user_id},
        UpdateExpression='ADD groups :g',
        ExpressionAttributeValues={':g': {group_id}},
    )

    log_event('group_created', group_id=group_id, user_id=user_id)
    return ok({'groupId': group_id, **group}, status=201)


def list_user_groups(event):
    user_id = get_user_id(event)
    if not user_id:
        return err('Missing X-User-Id header', 401)

    user = get_user(user_id)
    if not user:
        return err('User not found', 404)

    group_ids = list(user.get('groups') or set())
    groups = []
    for gid in group_ids:
        g = get_group(gid)
        if g:
            groups.append({'groupId': gid, **g})

    return ok({'groups': groups})


def get_group_detail(group_id):
    group = get_group(group_id)
    if not group:
        return err('Group not found', 404)

    members_info = []
    for uid in list(group.get('members') or set()):
        u = get_user(uid)
        if u:
            members_info.append({
                'userId':           uid,
                'displayName':      u.get('displayName', uid),
                'imageUrl':         u.get('imageUrl', ''),
                'trackCount':       len(u.get('topTrackIds') or []),
                'topTrackIds':      u.get('topTrackIds') or [],
                'topTrackNames':    u.get('topTrackNames') or [],
                'topTrackArtists':  u.get('topTrackArtists') or [],
                'topArtistIds':     u.get('topArtistIds') or [],
                'topArtistNames':   u.get('topArtistNames') or [],
                'genres':           u.get('genres') or [],
            })

    return ok({'groupId': group_id, **group, 'membersInfo': members_info})


def join_group(group_id, event):
    user_id = get_user_id(event)
    if not user_id:
        return err('Missing X-User-Id header', 401)

    group = get_group(group_id)
    if not group:
        return err('Group not found — check the code', 404)

    add_member_to_group(group_id, user_id)

    from db import USERS
    USERS().update_item(
        Key={'userId': user_id},
        UpdateExpression='ADD groups :g',
        ExpressionAttributeValues={':g': {group_id}},
    )

    log_event('group_joined', group_id=group_id, user_id=user_id,
              group_size=len(group.get('members') or set()) + 1)
    return ok({'message': f'Joined group {group_id}', 'groupId': group_id})
