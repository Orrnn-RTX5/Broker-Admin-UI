# CORS Issue Fix Guide

## The Problem

You're getting **"Failed to fetch"** error because:

1. Frontend runs on `http://localhost:5174` (or 5175, etc)
2. Broker backend runs on `https://103.91.186.142:8091`
3. Different origin = **CORS preflight request** is blocked
4. Browser blocks actual POST request until CORS is allowed

```
Browser Flow:
1. OPTIONS /manager/api/v2/auth/login (preflight)
2. Broker responds: ❌ Missing CORS headers
3. Browser: "No permission, blocking POST"
4. ❌ Failed to fetch
```

---

## Solution: Configure CORS on Broker Backend

The **broker VPS** needs to add CORS headers to all responses.

### Option 1: Nginx Reverse Proxy (Recommended)

If using Nginx on the broker server:

```nginx
# /etc/nginx/sites-available/broker.conf

server {
    listen 8091 ssl;
    server_name 103.91.186.142;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # CORS Headers
    add_header 'Access-Control-Allow-Origin' 'http://localhost:5174' always;
    add_header 'Access-Control-Allow-Origin' 'http://localhost:5173' always;
    add_header 'Access-Control-Allow-Origin' 'http://localhost:5175' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    add_header 'Access-Control-Max-Age' '3600' always;

    # Handle preflight
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    location /manager {
        proxy_pass http://manager-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Option 2: Manager Backend Code (Node/Express)

If manager-backend is Node.js:

```javascript
// middleware/cors.js
const cors = require('cors');

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600
};

module.exports = cors(corsOptions);
```

Then in your app:

```javascript
const corsMiddleware = require('./middleware/cors');
app.use(corsMiddleware);

// Handle preflight
app.options('*', corsMiddleware);
```

---

### Option 3: Python/Flask

```python
from flask_cors import CORS

CORS(app, 
     origins=[
         'http://localhost:5173',
         'http://localhost:5174', 
         'http://localhost:5175',
         'http://127.0.0.1:*'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     max_age=3600)
```

---

### Option 4: Go/Gin

```go
import "github.com/gin-contrib/cors"

config := cors.DefaultConfig()
config.AllowOrigins = []string{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
}
config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
config.AllowHeaders = []string{"Content-Type", "Authorization"}
config.MaxAge = 3600

r.Use(cors.New(config))
```

---

## Testing CORS Fix

After adding CORS headers, verify:

```bash
# Test preflight request
curl -X OPTIONS https://103.91.186.142:8091/manager/api/v2/auth/login \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v

# Should see response headers:
# < Access-Control-Allow-Origin: http://localhost:5174
# < Access-Control-Allow-Methods: GET, POST, ...
# < Access-Control-Allow-Headers: content-type
# < HTTP/1.1 200 OK  (or 204 No Content)
```

---

## Wildcard CORS (Not Recommended for Production)

If you want to allow all origins (⚠️ **NOT SECURE**):

### Nginx:
```nginx
add_header 'Access-Control-Allow-Origin' '*' always;
```

### Express:
```javascript
app.use(cors({ origin: '*' }));
```

### Flask:
```python
CORS(app, resources={r"/*": {"origins": "*"}})
```

**⚠️ WARNING**: This allows ANY website to access your broker API. Only use for development/testing!

---

## After Fixing CORS

1. **Rebuild frontend** (the code already handles it):
   ```bash
   npm run build
   ```

2. **Test login flow**:
   - Go to `http://localhost:5174`
   - Click "+ Register new broker"
   - Enter: `gta_broker`, `10015`, `Broker@...`, `103.91.186.142`
   - Should see ✅ "https://103.91.186.142:8091" in confirmation
   - Click Sign In
   - Should redirect to dashboard (no more "Failed to fetch")

3. **Check browser console** for success:
   ```
   [Auth Response Success] POST https://103.91.186.142:8091/manager/api/v2/auth/login
   ```

---

## Troubleshooting

### Still getting "Failed to fetch"?

Check broker logs:
```bash
# SSH into broker VPS
ssh user@103.91.186.142

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Or Docker logs
docker logs <broker_container> | grep -i cors

# Or Python logs
tail -f /var/log/app.log
```

### CORS headers not showing?

Verify the middleware/config is applied:
```bash
curl -I -X OPTIONS https://103.91.186.142:8091/manager/api/v2/auth/login

# Should show:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: http://localhost:5174
# Access-Control-Allow-Methods: POST, OPTIONS
# Access-Control-Allow-Headers: content-type
```

### Still failing even with CORS?

Could be:
1. **Certificate issue**: Self-signed cert? Browser might block it
   - Go to `https://103.91.186.142:8091` in browser
   - Accept the certificate warning
   - Try login again

2. **Firewall**: Port 8091 blocked?
   ```bash
   # Test connectivity
   curl -k https://103.91.186.142:8091/health
   ```

3. **Wrong endpoint**: Manager backend might not be responding
   ```bash
   # Check if service is running
   docker ps | grep manager
   netstat -tuln | grep 8091
   ```

---

## For Production

Use proper domain + valid SSL certificate:

```nginx
add_header 'Access-Control-Allow-Origin' 'https://admin.yourbroker.com' always;
```

Instead of:
```nginx
add_header 'Access-Control-Allow-Origin' '*' always;  # ⚠️ Never in production
```

---

## Summary

| Issue | Solution |
|-------|----------|
| `Failed to fetch` | Add CORS headers to broker backend |
| Port 443 in URL | ✅ Fixed in latest code (now defaults to 8091) |
| Preflight blocked | Ensure OPTIONS method is handled |
| "No permission" | Check CORS headers are in response |

Once CORS is configured on the broker VPS, your login flow will work!
