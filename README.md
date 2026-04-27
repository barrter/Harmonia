# Harmonia 🎵

> Group playlist generation powered by real Spotify listening data.

**Live:** [dcn82tlx35i8d.cloudfront.net](https://dcn82tlx35i8d.cloudfront.net)  
**API:** [s0lbmes14m.execute-api.us-east-2.amazonaws.com/prod](https://s0lbmes14m.execute-api.us-east-2.amazonaws.com/prod)  
**Region:** `us-east-2`

---

## What It Does

Harmonia connects a group of friends via Spotify OAuth, computes a real music compatibility score between every pair using Jaccard similarity, and exports a ranked group playlist directly to Spotify. No accounts to create — Spotify is the account.

---

## Architecture
┌─────────────────┐
                │   CloudFront    │  ← HTTPS CDN edge
                │  (React / S3)   │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │  API Gateway    │  ← REST, CORS, rate limiting
                └────────┬────────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    Auth Lambda   Profile Lambda   Group Lambda
    Match Lambda  Playlist Lambda
          │              │              │
          └──────────────┼──────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      DynamoDB      Secrets Mgr      CloudWatch
     (3 tables)    (Spotify creds)  (Logs + Alarms)
                                          │
                                     SQS DLQ ──► SNS ──► Email

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Lambda (x5)** | Auth, Profile, Group, Match, Playlist — stateless, auto-scales to zero |
| **API Gateway** | REST API with CORS, request routing, throttling |
| **DynamoDB (x3)** | harmonia-users-prod, harmonia-groups-prod, harmonia-scores-prod |
| **CloudFront + S3** | React frontend served globally via CDN |
| **Secrets Manager** | Spotify client_id and client_secret — fetched at Lambda runtime |
| **CloudWatch** | 5 log groups + 4 alarms + Harmonia-prod dashboard |
| **SQS DLQ** | harmonia-dlq-prod — catches failed Lambda invocations |
| **SNS** | harmonia-alerts-prod — fires alarms to email subscribers |

---

## Well-Architected Pillars

| Pillar | Implementation |
|--------|---------------|
| **SEC 2** | Spotify credentials in Secrets Manager. Every Lambda calls GetSecretValue at runtime. Zero hardcoded credentials. |
| **REL 6** | 4 CloudWatch alarms (API 5xx, DLQ depth, Match errors, Playlist errors) wired to SNS. All currently OK. |
| **PERF 3** | Compatibility scores cached in DynamoDB with ttl attribute (24hr TTL). Cache hit: <5ms vs ~800ms full compute. |
| **OPS 4** | Every Lambda emits structured JSON logs: event_type, user_id, latency_ms, group_id. CloudWatch Dashboard: Harmonia-prod. |
| **COST 3** | Every resource tagged env=prod, team=harmonia, component=<service>. Cost Explorer filterable by tag. |

---

## Scoring Algorithm

The Match Lambda computes a 0-100 compatibility score using Jaccard similarity:
Results are cached in DynamoDB with a 24-hour TTL. Cache hits return in under 5ms.

---

## Scaling to 1 Million Users

Harmonia is built on a fully serverless architecture. Scaling is handled automatically by AWS.

### What Scales Automatically

**Lambda** auto-scales to thousands of concurrent invocations with zero configuration. Each request gets its own isolated execution environment.

**DynamoDB** scales reads and writes on-demand. At 1M users with 100K daily active users generating ~10 operations each, DynamoDB handles this without any configuration changes.

**API Gateway** handles up to 10,000 requests per second by default. Rate limiting per user enforced at the API key level.

**CloudFront** serves the React frontend from 400+ edge locations worldwide. Users in Europe, Asia, and South America load the app from a nearby server, not us-east-2.

### What Would Need to Change

| Component | Current | At 1M Users |
|-----------|---------|-------------|
| **Spotify API** | Development mode (5 users) | Extended Quota Mode — apply via Spotify Partner form |
| **Score caching** | DynamoDB TTL (24hr) | ElastiCache Redis for sub-millisecond cache hits |
| **Token refresh** | Manual re-login | Lambda-based refresh token rotation |
| **CI/CD** | Manual sam deploy from CloudShell | GitHub Actions: test → build → deploy on push to main |
| **Observability** | CloudWatch alarms + dashboard | Add AWS X-Ray distributed tracing |
| **Multi-region** | Single region (us-east-2) | Route 53 latency routing across us-east-2, eu-west-1, ap-southeast-1 |
| **Database backups** | None | DynamoDB point-in-time recovery + daily S3 exports |

### Cost Estimate at Scale

At 100K daily active users (~1M Lambda invocations/day):

| Service | Monthly Cost (est.) |
|---------|---------------------|
| Lambda | ~$2 |
| DynamoDB | ~$15 |
| API Gateway | ~$35 |
| CloudFront | ~$10 |
| Secrets Manager + CloudWatch | ~$6 |
| **Total** | **~$68/month** |

---

## Deployment

```bash
# Deploy backend
sam build
sam deploy --stack-name harmonia \
  --region us-east-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=prod \
    SpotifyRedirectUri="https://YOUR_FRONTEND_URL/callback" \
    FrontendUrl="https://YOUR_FRONTEND_URL" \
  --resolve-s3 --no-confirm-changeset

# Store Spotify credentials
aws secretsmanager update-secret \
  --secret-id harmonia/spotify/credentials \
  --secret-string '{"client_id":"YOUR_ID","client_secret":"YOUR_SECRET"}'

# Deploy frontend
cd frontend
REACT_APP_API_URL=https://YOUR_API_URL npm run build
aws s3 sync build/ s3://YOUR_BUCKET --delete
aws s3 cp build/index.html s3://YOUR_BUCKET/index.html --cache-control "no-cache"
```

---

## Useful Commands

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/harmonia-match-prod --region us-east-2 --follow

# Check alarm states
aws cloudwatch describe-alarms --alarm-name-prefix harmonia \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}' --output table

# Clear cached score pair
aws dynamodb delete-item \
  --table-name harmonia-scores-prod --region us-east-2 \
  --key '{"pairKey": {"S": "userA:userB"}}'
```

---

## Future Roadmap

- [ ] GitHub Actions CI/CD pipeline
- [ ] Spotify Extended Access for user-top-read scope
- [ ] Automatic token refresh via refresh token rotation
- [ ] Audio feature scoring (tempo, energy, danceability)
- [ ] WebSocket real-time group updates
- [ ] AWS X-Ray distributed tracing
- [ ] Multi-region deployment via Route 53
- [ ] Harmonia Pro freemium tier ($4.99/mo)
