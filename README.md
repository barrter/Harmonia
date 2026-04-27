# Harmonia 🎵

Group playlist generation powered by real Spotify listening data.

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI: `pip install aws-sam-cli`
- Node 18+ and npm
- A Spotify Developer account

---

## Step 1 — Create Your Spotify App

1. Go to https://developer.spotify.com/dashboard
2. Click **Create app**
3. Set **Redirect URI** to `http://localhost:3000/callback` (for local dev)
4. Copy your **Client ID** and **Client Secret**

---

## Step 2 — First Deploy (run once)

```bash
# From the project root
sam build

sam deploy --guided
```

Answer the prompts:
- Stack Name: `harmonia`
- Region: `us-east-1` (or your preferred region)
- Environment: `prod`
- SpotifyRedirectUri: `https://YOUR-FRONTEND-URL/callback`  ← fill in after first deploy
- FrontendUrl: `https://YOUR-FRONTEND-URL`  ← fill in after first deploy

After first deploy, note the outputs:
- `ApiUrl` — your API Gateway URL
- `FrontendBucketName` — your S3 bucket name
- `FrontendUrl` — your S3 website URL
- `AlertTopicArn` — subscribe your email for alarm notifications

---

## Step 3 — Store Spotify Credentials in Secrets Manager

```bash
aws secretsmanager update-secret \
  --secret-id harmonia/spotify/credentials \
  --secret-string '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}'
```

---

## Step 4 — Update Spotify Redirect URI

In the Spotify Developer Dashboard, add your actual frontend URL as a redirect URI:
```
http://YOUR-S3-WEBSITE-URL.s3-website-us-east-1.amazonaws.com/callback
```

Then redeploy with the real URLs:
```bash
sam deploy \
  --stack-name harmonia \
  --parameter-overrides \
    Environment=prod \
    SpotifyRedirectUri="http://YOUR-BUCKET.s3-website-us-east-1.amazonaws.com/callback" \
    FrontendUrl="http://YOUR-BUCKET.s3-website-us-east-1.amazonaws.com"
```

---

## Step 5 — Build & Deploy Frontend

```bash
cd frontend

# Create your env file
cp .env.example .env.local
# Edit .env.local and set REACT_APP_API_URL to your ApiUrl output

npm install
npm run build

# Deploy to S3
aws s3 sync build/ s3://YOUR-BUCKET-NAME --delete
aws s3 cp build/index.html s3://YOUR-BUCKET-NAME/index.html \
  --cache-control "no-cache"
```

---

## Step 6 — Subscribe to Alerts

```bash
aws sns subscribe \
  --topic-arn YOUR_ALERT_TOPIC_ARN \
  --protocol email \
  --notification-endpoint your@email.com
```

Then confirm the subscription email.

---

## Local Development

```bash
# Terminal 1 — start SAM local API
sam build && sam local start-api --port 3001

# Terminal 2 — start React frontend  
cd frontend
cp .env.example .env.local
# Set REACT_APP_API_URL=http://localhost:3001
npm install && npm start
```

> Note: Spotify OAuth redirects won't work locally without an ngrok tunnel.
> For local testing use: `npx ngrok http 3001` and set that as your redirect URI.

---

## GitHub Actions (CI/CD)

Add these secrets to your GitHub repo (Settings → Secrets):

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `SPOTIFY_REDIRECT_URI` | Your deployed callback URL |
| `FRONTEND_URL` | Your deployed frontend URL |
| `FRONTEND_BUCKET` | Your S3 bucket name |

Push to `main` to trigger a full deploy.

---

## Architecture

```
GitHub Actions CI/CD
        │
        ▼
  API Gateway (REST)
  ┌─────┴──────────────────────────────────┐
  │  Auth λ    Profile λ   Group λ         │
  │  Match λ   Playlist λ                  │
  └──────────────────┬─────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      DynamoDB    Secrets    S3 (assets)
      (3 tables)  Manager
      
  Well-Architected pillars:
  SEC2  → Secrets Manager (no hardcoded keys)
  REL6  → CloudWatch alarms + DLQ retries
  PERF3 → DynamoDB TTL score cache (24h)
  OPS4  → Structured JSON logs + CW dashboard
  COST3 → env/team/component tags on every resource
```

---

## Useful Commands

```bash
# View CloudWatch logs for a function
sam logs -n MatchFunction --stack-name harmonia --tail

# Force-clear a cached score pair
aws dynamodb delete-item \
  --table-name harmonia-scores-prod \
  --key '{"pairKey": {"S": "userA:userB"}}'

# Check alarm states
aws cloudwatch describe-alarms \
  --alarm-name-prefix harmonia \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}'
```
