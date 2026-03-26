# Deployment Guide

> Phase 4 will expand this document with full local development, Railway,
> DigitalOcean, and n8n Cloud instructions. The sections below were added
> in Phase 2.5 to document monitoring and production requirements.

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
- [ ] `N8N_PUBLIC_URL` set to production domain
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
- Railway has an outage affecting the deployment

Do **not** skip this step. It is the only way to detect outages that
happen outside business hours.
