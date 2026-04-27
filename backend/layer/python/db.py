import os
import json
import time
import logging
import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ddb = boto3.resource('dynamodb')

USERS  = lambda: _ddb.Table(os.environ['USERS_TABLE'])
GROUPS = lambda: _ddb.Table(os.environ['GROUPS_TABLE'])
SCORES = lambda: _ddb.Table(os.environ['SCORES_TABLE'])


# ── Structured logging (OPS4) ────────────────────────────────────────────────

def log_event(event_type, **kwargs):
    payload = {'event_type': event_type, 'ts': int(time.time()), **kwargs}
    logger.info(json.dumps(payload))


# ── Users ────────────────────────────────────────────────────────────────────

def get_user(user_id):
    resp = USERS().get_item(Key={'userId': user_id})
    return resp.get('Item')


def put_user(user_id, data):
    USERS().put_item(Item={'userId': user_id, **data})


def update_user(user_id, updates):
    exprs, names, vals = [], {}, {}
    for k, v in updates.items():
        safe = f"#f{len(names)}"
        names[safe] = k
        vals[f":v{len(vals)}"] = v
        exprs.append(f"{safe} = :v{len(vals)-1}")
    USERS().update_item(
        Key={'userId': user_id},
        UpdateExpression='SET ' + ', '.join(exprs),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=vals,
    )


# ── Groups ───────────────────────────────────────────────────────────────────

def get_group(group_id):
    resp = GROUPS().get_item(Key={'groupId': group_id})
    return resp.get('Item')


def put_group(group_id, data):
    GROUPS().put_item(Item={'groupId': group_id, **data})


def add_member_to_group(group_id, user_id):
    GROUPS().update_item(
        Key={'groupId': group_id},
        UpdateExpression='ADD members :m',
        ExpressionAttributeValues={':m': {user_id}},
    )


# ── Scores (cached 24h TTL — PERF3) ─────────────────────────────────────────

SCORE_TTL = 86400  # 24 hours


def make_pair_key(a, b):
    return ':'.join(sorted([a, b]))


def get_cached_score(user_a, user_b):
    key = make_pair_key(user_a, user_b)
    resp = SCORES().get_item(Key={'pairKey': key})
    item = resp.get('Item')
    if item and item.get('ttl', 0) > time.time():
        return float(item['score'])
    return None


def put_cached_score(user_a, user_b, score):
    key = make_pair_key(user_a, user_b)
    SCORES().put_item(Item={
        'pairKey': key,
        'score': str(score),
        'ttl': int(time.time()) + SCORE_TTL,
        'computedAt': int(time.time()),
    })


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def ok(body, status=200):
    return {
        'statusCode': status,
        'headers': cors_headers(),
        'body': json.dumps(body, default=str),
    }


def err(msg, status=400):
    return {
        'statusCode': status,
        'headers': cors_headers(),
        'body': json.dumps({'error': msg}),
    }


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json',
    }


def get_user_id(event):
    """Extract userId from header (set by frontend after auth)."""
    hdrs = event.get('headers') or {}
    return (hdrs.get('X-User-Id') or hdrs.get('x-user-id') or '').strip()
