# Deployment Guide

This guide covers every deployment path for the Voice Agent Template:
local development, Railway (quick/cheap), and DigitalOcean Droplet
(production/scale). Pick the path that matches the client's stage.

---

## Local Development

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts three services:

| Service | Port | Purpose |
|---------|------|---------|
| **postgres** (pgvector) | 5432 | Application database + n8n database |
| **n8n** | 5678 | Workflow automation UI and API |
| **minio** | 9000 (API), 9001 (console) | Local S3-compatible object storage |

PostgreSQL runs the `pgvector/pgvector:pg15` image so the `vector`
extension is available for embeddings. Two databases are created on
first run: `voice_agent` (application data) and `n8n_db` (n8n
credentials and workflow state, kept separate for security).

### 2. Install dependencies and run setup

```bash
npm install
npm run setup
```

`npm run setup` validates environment variables, tests all API
connections, runs Supabase migrations, and deploys n8n workflows.

### 3. Start the webhook server

```bash
npm run dev
```

The server starts on `http://localhost:3000` (configurable via
`WEBHOOK_PORT` in `.env`).

### 4. Expose webhooks with ngrok

Vapi must be able to reach your webhook server over the public internet.
Use ngrok to tunnel traffic to your local machine:

```bash
# Install ngrok (one-time)
# https://ngrok.com/download — or: brew install ngrok

# Start tunnel
ngrok http 3000
```

ngrok will print a public URL like `https://abc123.ngrok-free.app`.

### 5. Point Vapi to your ngrok URL

In the Vapi dashboard (or via the API when creating/updating your
assistant), set the **Server URL** to:

```
https://abc123.ngrok-free.app/webhook/vapi
```

Replace `abc123.ngrok-free.app` with your actual ngrok URL. This URL
changes every time you restart ngrok (unless you use a paid plan with
a reserved domain).

### 6. Route a Telnyx number to Vapi

1. Purchase a phone number in the Telnyx Portal
2. In Telnyx, go to **Numbers > your number > Voice Settings**
3. Set **Connection** to a SIP Connection pointing to Vapi's SIP URI
   (provided in the Vapi dashboard under **Phone Numbers > Import**)
4. In Vapi, import the Telnyx number and assign it to your assistant

Once routed, inbound calls to the Telnyx number will flow through Vapi
to your webhook server.

---

## Railway Deployment

Railway is the simplest deployment path. One command deploys from
GitHub, costs ~$5/month per client, and includes built-in logging.

### 1. Install the Railway CLI and authenticate

```bash
npm install -g @railway/cli
railway login
```

### 2. Create a project and link your repo

```bash
# From the client repo directory
railway init
railway link
```

### 3. Configure environment variables

In the Railway dashboard, go to your service's **Variables** tab and
add every variable from `.env.example`. At minimum:

- `NODE_ENV=production`
- `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET`
- `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `N8N_BASE_URL` (your n8n instance URL)
- `TRANSFER_PHONE_NUMBER` (if agent uses transfer-to-human)

Do not set `WEBHOOK_PORT` — Railway assigns the port via `PORT`
automatically and the server defaults to 3000 if `PORT` is not set.

### 4. Deploy

```bash
railway up
```

Railway uses the `railway.toml` in the repo root. It runs `npm run
build` then `npm start`, and uses `/health` for zero-downtime deploys.
If `/health` does not return 200, the new deploy will not replace the
old one.

### 5. Check logs

```bash
railway logs
```

Or use the Railway dashboard's **Deployments > Logs** tab. The server
outputs structured JSON logs — use Railway's log search to filter by
`callId` or `service`.

### 6. Verify the deployment

```bash
# Point npm run validate at production services
# (set env vars to production values in your shell, or run from Railway shell)
npm run validate
```

Update the Vapi server URL to point to your Railway deployment URL
(found in the Railway dashboard under **Settings > Domains**).

---

## DigitalOcean Droplet (Production)

For production clients at scale, a DigitalOcean droplet gives more
control, better pricing at volume, and dedicated resources. This
section is a step-by-step guide with commands you can copy and run.

> **Security: Postgres password** — Before exposing any ports, change the
> default postgres password in `docker-compose.yml` from `postgres` to a
> strong generated password. Update all `DB_POSTGRESDB_PASSWORD` references
> in the compose file to match. Never expose port 5432 publicly — ensure
> UFW blocks it (`sudo ufw deny 5432`).

### Droplet sizing

| Expected call volume | Droplet size | Monthly cost |
|---------------------|-------------|-------------|
| Up to 20 concurrent calls | Basic, 2 vCPU / 2 GB RAM | ~$18/mo |
| Up to 50 concurrent calls | Basic, 2 vCPU / 4 GB RAM | ~$24/mo |
| 50+ concurrent calls | General Purpose, 4 vCPU / 8 GB RAM | ~$63/mo |

Start with the 2 vCPU / 2 GB droplet. The webhook server is I/O-bound
(waiting on external APIs), not CPU-bound, so small instances handle
surprisingly many calls. Monitor with `htop` and scale up if CPU stays
above 80% during peak.

Create the droplet with **Ubuntu 24.04 LTS** and enable **Volume
Encryption** during creation.

### 1. Initial server setup

SSH into the droplet and create a non-root deploy user:

```bash
ssh root@YOUR_DROPLET_IP

# Update system packages
apt update && apt upgrade -y

# Create deploy user with sudo
adduser deploy
usermod -aG sudo deploy

# Set up SSH key for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Disable root SSH login (optional but recommended)
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

Log out and reconnect as the deploy user:

```bash
ssh deploy@YOUR_DROPLET_IP
```

### 2. Install Node.js 22 LTS

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # v22.x.x
npm --version    # 10.x.x
```

### 3. Install Docker and Docker Compose

Docker is needed for the local PostgreSQL, n8n, and MinIO services.
Skip this if the client uses managed services (Supabase Cloud, n8n
Cloud) and does not need local infrastructure.

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy

# Log out and back in for group change to take effect
exit
ssh deploy@YOUR_DROPLET_IP

# Verify
docker --version
docker compose version
```

### 4. Install nginx as reverse proxy

```bash
sudo apt install -y nginx

# Remove default site
sudo rm /etc/nginx/sites-enabled/default
```

Create the site config:

```bash
sudo tee /etc/nginx/sites-available/voice-agent > /dev/null << 'NGINX'
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGINX
```

Replace `YOUR_DOMAIN` with the actual domain (e.g.
`agent.clientname.com`). Then enable and start:

```bash
sudo ln -s /etc/nginx/sites-available/voice-agent /etc/nginx/sites-enabled/
sudo nginx -t          # Test config — must say "ok"
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 5. SSL certificate via certbot

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate — certbot will auto-configure nginx for HTTPS
sudo certbot --nginx -d YOUR_DOMAIN

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot sets up a cron job for automatic renewal. After this step,
`https://YOUR_DOMAIN/health` should be reachable (once the app is
running).

### 6. Clone and build the application

```bash
cd /home/deploy
git clone git@github.com:YOUR_ORG/client-voice-agent.git app
cd app
npm install
npm run build
```

### 7. Environment variable management

Create the `.env` file on the server. Never commit this file.

```bash
cp .env.example .env
nano .env
# Fill in all production API keys
```

Set `NODE_ENV=production` and all required keys. See the Production
Checklist below for the full list.

To protect the file:

```bash
chmod 600 .env
```

### 8. Run database setup

If using local Docker services:

```bash
docker compose up -d
npm run setup
```

If using managed Supabase (recommended for production): skip Docker for
postgres, just run `npm run setup` with the Supabase URL and service
key in `.env`.

### 9. Install PM2 for process management

PM2 keeps the webhook server running, restarts it on crashes, and
manages log rotation.

```bash
sudo npm install -g pm2

# Start the application
cd /home/deploy/app
pm2 start dist/index.js --name voice-agent

# Save the process list so PM2 restarts on reboot
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Run the command PM2 prints (it requires sudo)
```

Useful PM2 commands:

```bash
pm2 status              # Check if the app is running
pm2 logs voice-agent    # View live logs
pm2 restart voice-agent # Restart after a deploy
pm2 monit               # Real-time CPU/memory monitor
```

### 10. Deploy updates from GitHub

```bash
cd /home/deploy/app
git pull origin main
npm install
npm run build
pm2 restart voice-agent

# Verify the deployment
npm run validate
```

To automate this, create a deploy script:

```bash
cat > /home/deploy/deploy.sh << 'SCRIPT'
#!/bin/bash
set -e
cd /home/deploy/app
git pull origin main
npm install --production
npm run build
pm2 restart voice-agent
echo "Deploy complete. Running validation..."
npm run validate
SCRIPT
chmod +x /home/deploy/deploy.sh
```

Then deploy with: `./deploy.sh`

### Railway vs Droplet comparison

| Factor | Railway | DigitalOcean Droplet |
|--------|---------|---------------------|
| Setup time | 5 minutes | 30-60 minutes |
| Monthly cost | ~$5-20/client | ~$18-24/client (shared across clients) |
| Scaling | Add more Railway services | Resize droplet or add load balancer |
| SSL | Automatic | Certbot (auto-renewing) |
| Logs | Built-in dashboard | PM2 logs + optional log drain |
| Multi-client | Separate Railway project per client | Multiple PM2 processes on one droplet |
| Control | Limited (PaaS) | Full (your server) |
| Best for | Early clients, quick deploys | Production scale, cost optimization |

**Recommendation**: Start with Railway for the first 1-3 clients. Move
to a droplet when monthly Railway costs exceed ~$50 or when you need
more control over the infrastructure.

---

## n8n Cloud Alternative

By default, n8n runs as a Docker container alongside the application.
For production, n8n Cloud is an alternative that eliminates the need to
manage n8n infrastructure yourself.

### When to use n8n Cloud

- You are deploying to Railway (which does not run Docker containers
  for you)
- You want managed updates, backups, and uptime for n8n
- The client wants a separate n8n UI login for their team

### When to self-host n8n

- You are on a DigitalOcean droplet and Docker is already running
- You need full control over n8n configuration and credentials
- Cost sensitivity — self-hosted is free, Cloud starts at $20/month

### Setup

1. Sign up at [n8n.io/cloud](https://n8n.io/cloud)
2. Create an instance — you will get a URL like
   `https://your-instance.app.n8n.cloud`
3. Generate an API key in n8n Cloud: **Settings > API > Create API Key**
4. Update `.env` in the client repo:

```bash
N8N_BASE_URL=https://your-instance.app.n8n.cloud
N8N_API_KEY=your-cloud-api-key
```

5. Re-run setup to deploy workflows to the cloud instance:

```bash
npm run setup
```

The application code does not change — only the URL and API key differ.

---

## Monitoring

### workflow_errors Table

The `workflow_errors` table in Supabase is the central log for silent
failures detected by the monitoring workflows. A healthy system has
**zero rows**. Any rows indicate a failure that requires investigation.

**Check this table weekly** (or after any known incident):

```sql
SELECT * FROM workflow_errors ORDER BY created_at DESC LIMIT 50;
```

Common entries and what they mean:

| workflow | meaning |
|----------|---------|
| `training-pipeline-monitor` | Calls completed but no training data was written — the call-ended pipeline may be broken |
| `recording-archive-monitor` | A recording was not archived to S3 within 15 minutes of call end — archival may be stuck or S3 credentials may be invalid |

When you see rows:
1. Investigate the root cause using the `metadata` JSON column
2. Fix the underlying issue
3. Delete the resolved rows so the table returns to zero

### /health Endpoint

The `/health` endpoint performs a deep probe of all connected services
and returns per-service status. It is the primary target for external
uptime monitoring.

Response shape:
```json
{
  "status": "ok | degraded | down",
  "timestamp": "ISO string",
  "version": "1.0.0",
  "activeCalls": 0,
  "maxConcurrentCalls": 20,
  "services": {
    "supabase": { "status": "ok", "latencyMs": 45 },
    "pinecone": { "status": "ok", "latencyMs": 120 },
    "mem0": { "status": "disabled" },
    "n8n": { "status": "ok", "latencyMs": 30 }
  }
}
```

- `ok` — all enabled services reachable and responding under 2 seconds
- `degraded` — all services reachable but one or more responding slowly (>2s)
- `down` — one or more required services unreachable
- `disabled` — service turned off via feature flag (not probed)

---

## Production Checklist

Before going live with any client deployment, complete every item:

- [ ] `NODE_ENV=production` set
- [ ] `VAPI_WEBHOOK_SECRET` set (not empty)
- [ ] `TRANSFER_PHONE_NUMBER` set (if agent uses TRANSFER_TO_HUMAN tool)
- [ ] `N8N_BASE_URL` set to production n8n instance URL
- [ ] Volume encryption enabled (DigitalOcean or Railway)
- [ ] Log drain configured (Railway dashboard or external service)
- [ ] All API keys rotated from any shared/test values
- [ ] `npm run validate` passes against production services
- [ ] Test call completed successfully
- [ ] `workflow_errors` table empty after test call

### UptimeRobot External Monitor (Required)

Railway's internal health monitoring only detects container crashes. It
does not catch cases where the server is running but returning errors, or
where Railway itself has an outage. An external uptime monitor is
**required** for every production deployment.

Setup steps:

1. Register at [uptimerobot.com](https://uptimerobot.com) (free tier is sufficient)
2. Create a new **HTTP(s)** monitor
3. Set the URL to: `https://[your-domain]/health`
4. Set the monitoring interval to **60 seconds**
5. Configure alert contacts:
   - **Email**: Add the client's operations contact and your own
   - **SMS**: Add at least one phone number for critical alerts
6. Set the alert condition: status code != 200 OR response body does not
   contain `"status":"ok"`
7. Save the monitor URL in the client repo's `.env.example` as a comment:
   ```
   # UPTIME_MONITOR_URL=https://uptimerobot.com/dashboard#[monitor-id]
   ```

The monitor will alert within 60 seconds if:
- The server goes down entirely
- The server is up but a downstream service (Supabase, Pinecone, etc.) is unreachable
- Railway or DigitalOcean has an outage affecting the deployment

Do **not** skip this step. It is the only way to detect outages that
happen outside business hours.
