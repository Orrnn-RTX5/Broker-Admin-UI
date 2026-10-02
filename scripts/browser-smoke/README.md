# Admin group browser smoke

This mounts the Admin group symbol picker and account creation dialog with
in-memory service responses. It makes no API calls or account changes.

Run Vite on loopback, then open `http://127.0.0.1:5189/scripts/browser-smoke/index.html`:

```powershell
$env:VITE_API_HOST='http://127.0.0.1:59999'
$env:VITE_API_HOST_EXT='http://127.0.0.1:59999'
$env:VITE_SUPER_ADMIN_API_HOST='http://127.0.0.1:59999'
npm exec vite -- --host 127.0.0.1 --port 5189 --strictPort
```

The page reports PASS or FAIL for saved symbol visibility, empty and ready
selected-feed catalog behavior, permanent account mode at creation, coverage
purpose and the missing-route warning. It does not exercise login or backend
network contracts.
