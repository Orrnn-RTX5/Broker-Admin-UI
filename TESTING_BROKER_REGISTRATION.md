# Testing Broker Registration Flow

## Quick Start - Test with Your Credentials

### Your Broker Details (from Vault screenshot):
```
Broker ID:        gta_broker
Manager Login:    10015
Manager Password: Broker@2015ACC17CCF3657D4AFB8705F965AA
Server IP:        103.91.186.142
```

## Testing Steps

### 1. Open the App
- Navigate to `http://localhost:5175`
- You should see the **Broker Selector** screen

### 2. Register New Broker
- Click the **"+ Register new broker"** link at the bottom
- This navigates to `/broker-manual-entry`

### 3. Step 1: Enter Credentials
Fill in the form with your broker details:

```
Broker ID:        gta_broker
License Key:      (leave empty - optional)
Manager Login #:  10015
Password:         Broker@2015ACC17CCF3657D4AFB8705F965AA
Server URL/IP:    103.91.186.142
```

**Click "Validate & Continue"**

### 4. Step 2: Confirm Details
You should see a confirmation screen showing:
```
Broker ID:      gta_broker
Manager Login:  10015
Server:         https://103.91.186.142:8091
```

**Click "Sign In"**

---

## What Gets Fixed

### Issue 1: Default Port (FIXED ✅)
- **Before**: `103.91.186.142` → `https://103.91.186.142` (no port = browser defaults to 443)
- **After**: `103.91.186.142` → `https://103.91.186.142:8091` (properly adds 8091)

### Issue 2: Server Parameter in Login (FIXED ✅)
- **Before**: Sent `server: "103.91.186.142"` in login request
- **After**: Sends `server: "gta_broker"` (the broker_id) in login request
  ```javascript
  POST https://103.91.186.142:8091/manager/api/v2/auth/login
  {
    "user": "10015",
    "password": "Broker@2015ACC17CCF3657D4AFB8705F965AA",
    "server": "gta_broker"  // ← This is now correct
  }
  ```

### Issue 3: Broker Info Persistence (FIXED ✅)
- Broker info stored in sessionStorage after validation
- Retrieved correctly on login submission
- All fields properly normalized and accessible

---

## Expected Response Flow

### If Login Succeeds:
```json
{
  "token": "token-string-here",
  "refresh_token": "refresh-token-here",
  "login": 10015,
  "is_admin": false,
  "broker_id": "gta_broker"
}
```

→ Redirects to `/dashboard`

### If Login Fails:
Error message displayed (check browser console for details):
- "Wrong login or password" - Invalid credentials
- "Server mismatch" - Broker ID doesn't match server
- "Account is disabled" - Manager account not active
- "Connection failed" - Server unreachable

---

## Server URL Format Support

All these formats are now supported:

```
103.91.186.142
→ https://103.91.186.142:8091

103.91.186.142:8091
→ https://103.91.186.142:8091

103.91.186.142:8000
→ http://103.91.186.142:8000

broker.example.com
→ https://broker.example.com:8091

broker.example.com:3000
→ http://broker.example.com:3000

https://broker.example.com
→ https://broker.example.com
```

---

## Debugging

### Check Browser Console
Open DevTools (F12) and check Console tab for:
```
[Auth Validate] Checking broker connectivity to https://103.91.186.142:8091
[Auth Request] POST https://103.91.186.142:8091/manager/api/v2/auth/login
[Auth Response Success] ...
```

### Check Session Storage
In DevTools → Application → Session Storage:
```
broker_info: {
  "broker_id": "gta_broker",
  "name": "gta_broker",
  "status": "active",
  "backend_url": "https://103.91.186.142:8091",
  "server_ip": "103.91.186.142",
  "license_key": ""
}

auth: {
  "token": "...",
  "refresh_token": "...",
  "login": 10015,
  "is_admin": false,
  "broker_id": "gta_broker"
}
```

---

## If It Still Doesn't Work

1. **Server unreachable?**
   - Verify `103.91.186.142:8091` is accessible
   - Check if VPS is running
   - Verify firewall allows connections

2. **Wrong credentials?**
   - Double-check from vault: login number & password
   - Make sure password wasn't changed since vault screenshot

3. **Broker ID mismatch?**
   - Ensure `gta_broker` exists on the server
   - Must match exactly (case-sensitive)

4. **Need to reset password?**
   - Use "Reset Password" button in vault
   - Wait for system sync
   - Copy new password and try again

---

## Browser DevTools Tips

### Network Tab
Watch for POST to `/manager/api/v2/auth/login`:
- Check request body has correct `server: "gta_broker"`
- Check response has `token` field

### Console Tab
Look for:
- ✅ `[Auth Response Success]` - Good!
- ❌ `[Auth Response Error]` - Check error details
- ❌ `[Auth Connection Failed]` - Server not reachable

---

## Summary of Code Changes

### Files Modified:
1. **src/services/brokerAuth.js**
   - Fixed `normalizeBackendUrl()` to default port to 8091

2. **src/components/organisms/BrokerAuthScreens.jsx**
   - Fixed login call to use `broker_id` instead of server IP in request
   - Added validation that brokerInfo exists before login

Result: ✅ Broker credentials now properly persisted and used
