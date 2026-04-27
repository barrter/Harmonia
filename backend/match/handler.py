import sys
import time
from itertools import combinations

sys.path.insert(0, '/opt/python')
from db import (get_group, get_user, get_cached_score, put_cached_score,
                ok, err, get_user_id, log_event)


def lambda_handler(event, context):
    group_id = (event.get('pathParameters') or {}).get('groupId')
    if not group_id:
        return err('Missing groupId', 400)

    group = get_group(group_id)
    if not group:
        return err('Group not found', 404)

    members = list(group.get('members') or set())
    if len(members) < 2:
        return ok({'scores': [], 'groupScore': 0, 'message': 'Need at least 2 members'})

    users = {}
    for uid in members:
        u = get_user(uid)
        if u:
            users[uid] = u

    pair_scores = []
    cache_hits, cache_misses = 0, 0
    t_start = time.time()

    for a, b in combinations(list(users.keys()), 2):
        cached = get_cached_score(a, b)
        if cached is not None:
            score = cached
            cache_hits += 1
        else:
            score = compute_compatibility(users[a], users[b])
            put_cached_score(a, b, score)
            cache_misses += 1

        pair_scores.append({
            'userA': a,
            'nameA': users[a].get('displayName', a),
            'userB': b,
            'nameB': users[b].get('displayName', b),
            'score': round(score, 1),
        })

    group_score = round(sum(p['score'] for p in pair_scores) / len(pair_scores), 1) if pair_scores else 0
    latency_ms = round((time.time() - t_start) * 1000, 1)

    log_event('scores_computed',
              group_id=group_id,
              group_size=len(members),
              group_score=group_score,
              cache_hits=cache_hits,
              cache_misses=cache_misses,
              latency_ms=latency_ms)

    return ok({
        'groupId':    group_id,
        'groupScore': group_score,
        'pairScores': sorted(pair_scores, key=lambda x: -x['score']),
        'meta': {
            'cacheHits':   cache_hits,
            'cacheMisses': cache_misses,
            'latencyMs':   latency_ms,
        },
    })


def compute_compatibility(user_a, user_b):
    """
    Score breakdown (0–100):
      40pts  artist overlap
      30pts  genre overlap
      30pts  (reserved — energy similarity requires audio features API call)
    """
    artists_a = set(user_a.get('topArtistIds') or [])
    artists_b = set(user_b.get('topArtistIds') or [])
    union_a = artists_a | artists_b
    artist_score = (len(artists_a & artists_b) / len(union_a) * 40) if union_a else 0

    genres_a = set(user_a.get('genres') or [])
    genres_b = set(user_b.get('genres') or [])
    union_g = genres_a | genres_b
    genre_score = (len(genres_a & genres_b) / len(union_g) * 30) if union_g else 0

    # Track overlap bonus (up to 30pts)
    tracks_a = set(user_a.get('topTrackIds') or [])
    tracks_b = set(user_b.get('topTrackIds') or [])
    union_t = tracks_a | tracks_b
    track_score = (len(tracks_a & tracks_b) / len(union_t) * 30) if union_t else 0

    return min(100.0, artist_score + genre_score + track_score)
