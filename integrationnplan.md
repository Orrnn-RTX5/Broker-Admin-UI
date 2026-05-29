
Broker Creation — Complete Flow
License Key + Admin Credentials — Kahan Jaata Hai, Kaise Kaam Karta Hai


Pehle Poora Picture Dekho (3 Minute Read)
Jab SuperAdmin ek naya broker create karta hai, 3 cheezein ban jaati hain:

SuperAdmin calls POST /api/v1/brokers
              │
              ▼
    ┌─────────────────────────────────────────────────────┐
    │  3 cheezein automatic ban jaati hain:               │
    │                                                     │
    │  1. LICENSE KEY                                     │
    │     RTX5-ENT-MYBRO-2026-A1B2C3D4...                │
    │     → broker ke .env mein jaata hai                 │
    │     → license-agent isko validate karta hai         │
    │                                                     │
    │  2. MANAGER LOGIN NUMBER                            │
    │     e.g. 10016                                      │
    │     → broker staff ka login ID hota hai             │
    │                                                     │
    │  3. MANAGER PASSWORD                                │
    │     e.g. Broker@9850441A52F4E9FF...                 │
    │     → broker ke VPS mein push hota hai              │
    │     → broker staff isse Manager Panel mein login    │
    │       karta hai                                     │
    └─────────────────────────────────────────────────────┘


Ab dono cheezein detail mein samajhte hain.




PART 1 — LICENSE KEY


License Key Kahan Jaata Hai?

SuperAdmin creates broker
          │
          ▼
Response mein aata hai:
{
  "license_key": "RTX5-ENT-MYBRO-2026-A1B2C3D4E5F6",
  ...
}
          │
          │  ← YEH KEY LENI HAI AUR BROKER KE .env MEIN DAALNI HAI
          ▼
Broker ke GitHub Secret BROKER_ENV_<NAME> mein yeh lines add karo:

  BROKER_ID=my_broker
  RTX5_LICENSE_KEY=RTX5-ENT-MYBRO-2026-A1B2C3D4E5F6

          │
          ▼
CI/CD deploy hota hai → /opt/rtx5/.env ban jaata hai VPS pe
          │
          ▼
license-agent container start hota hai
          │
          ▼
License-agent SuperAdmin ke License Server ko call karta hai:
POST https://superbackend.orrnn.com/license/api/v1/validate
Body: {
  "license_key": "RTX5-ENT-MYBRO-2026-A1B2C3D4E5F6",
  "broker_id":   "my_broker"
}
          │
          ▼
SuperAdmin validate karta hai aur license details return karta hai:
{
  "plan": "enterprise",
  "status": "active",
  "max_accounts": 999999,
  "valid_until": 1811398635,
  "modules_enabled": ["trading","manager","risk","reports"]
}
          │
          ▼
License-agent isko Redis (DragonflyDB) mein cache karta hai
Key: "license:current"
          │
          ▼
Sab services (manager-backend, engine, etc.) yahi Redis key padhti hain
Broker active ho jaata hai ✅




Broker ke .env mein License ke liye Exactly Kya Daalna Hai
Jab tum BROKER_ENV_MYBROKER GitHub Secret banate ho, usme yeh lines must honi chahiye:

# ─── BROKER IDENTITY & LICENSE ───────────────────────────────────
BROKER_ID=my_broker
RTX5_LICENSE_KEY=RTX5-ENT-MYBRO-2026-A1B2C3D4E5F6

# License server URL — yeh always yahi rehti hai (change mat karna)
RTX5_LICENSE_SERVER_URL=https://superbackend.orrnn.com/license



NOTE: BROKER_ID yahan jo daalo, wahi broker_id SuperAdmin mein honi chahiye. Dono ek jaisi nahi hogi toh license validate nahi hoga.




License Validate Nahi Ho Raha? — Troubleshoot Karo

Diagnose Broker workflow chalao → docker logs rtx5-license-agent check karo

Common errors:

❌ "RTX5_LICENSE_KEY is required but not set"
   Fix: BROKER_ENV secret mein RTX5_LICENSE_KEY add karo

❌ "License validation failed: invalid key"
   Fix: SuperAdmin response se sahi key copy karo (typo check karo)

❌ "broker_id mismatch"
   Fix: BROKER_ID in .env === broker_id in SuperAdmin DB (exact match)

✅ "License validated successfully"
   Sab theek hai




License Kitne Time Baad Renew Hoti Hai?

Har 24 ghante mein license-agent SuperAdmin ko heartbeat bhejta hai:
POST /license/api/v1/heartbeat
Body: {
  license_key: "...",
  broker_id: "...",
  accounts: 150,      ← kitne active accounts hain
  deals: 3200,        ← kitne trades hue
  volume: 1234.56
}

SuperAdmin check karta hai:
  → License valid hai? → Haan → Cache refresh ho jaata hai (7 din ke liye)
  → License expire ho gayi? → Broker ko grace period milti hai
  → Grace period bhi khatam? → Broker locked (read-only mode)






PART 2 — BROKER ADMIN CREDENTIALS


Manager Account Kaise Banta Hai?
Jab SuperAdmin broker create karta hai — automatically ek Admin Manager account ban jaata hai.

POST /api/v1/brokers
{
  "broker_id": "my_broker",
  "name": "My Broker Ltd",
  ...
}
          │
          ▼
Behind the scenes (ek hi DB transaction mein):

  Step A: broker row insert hota hai
  Step B: broker_servers mein server_ip add hoti hai  
  Step C: manager_accounts mein ek row insert hoti hai
          {
            login:    10016,          ← auto-generated number
            name:     "My Broker Ltd Admin",
            is_admin: true,
            broker_id: "my_broker"
          }
  Step D: password generate hota hai → "Broker@<random 32 chars>"
  Step E: bcrypt(password) → manager_accounts.password_hash
          AES(password)    → manager_credentials_vault.password_enc
          (dono save hoti hain — ek login ke liye, ek recovery ke liye)
          │
          ▼
Response mein aata hai (SIRF YAHAN plaintext dikhta hai):
{
  "manager_credentials": {
    "login":    10016,
    "password": "Broker@A3F9D2E1B8C4F7E2...",
    "name":     "My Broker Ltd Admin",
    "role":     "super_admin"
  }
}



⚠️ IMPORTANT: Yeh response dekh ke turant login aur password save kar lo. Baad mein bhi retrieve ho sakta hai via API, but acha hai ki abhi hi copy kar lo.




Credentials Broker ke VPS Tak Kaise Pohonchta Hai?
Sirf SuperAdmin ke database mein password save hona kaafi nahi. Broker ke VPS ko bhi pata hona chahiye ki manager ka login aur password kya hai.
Isko Provision kehte hain.

┌──────────────────────────────────────────────────────────────────┐
│                     PROVISION FLOW                               │
└──────────────────────────────────────────────────────────────────┘

SuperAdmin Database mein save hua:
  login: 10016
  password: "Broker@A3F9..."
  bcrypt_hash: "$2a$10$..."
  aes_encrypted: "U2FsdGVk..."
          │
          │  ← ab yeh VPS tak pohonchaana hai
          ▼
SuperAdmin check karta hai:
  broker ki api_url set hai?
  (e.g. http://103.91.186.142:8091)
          │
     ┌────┴────┐
  SET hai    NOT SET
     │            │
     ▼            ▼
  Continue    Skip provision
              (password SuperAdmin mein hai
               but VPS nahi jaanta)
     │
     ▼
SuperAdmin ek JWT banata hai (RS256, 10 min valid):
  Signs with: SUPER_ADMIN_PRIVATE_KEY
  Contains:
  {
    "broker_id": "my_broker",
    "login":     10016,
    "name":      "My Broker Ltd Admin",
    "password":  "Broker@A3F9...",
    "is_admin":  true,
    "event_type":"create"
  }
          │
          ▼
POST http://103.91.186.142:8091/internal/provision/manager
Authorization: Bearer <signed-jwt>
          │
          ▼
Broker ke VPS pe:
  manager-backend JWT ko verify karta hai:
  (uses SUPER_ADMIN_PUBLIC_KEY_B64 from .env)
          │
          ▼
  Valid hai? → manager_accounts mein INSERT ya UPDATE
              (upsert — naya account ya existing update)
          │
          ▼
  Response: 200 OK
          │
          ▼
SuperAdmin logs mein:
"Manager provisioned to broker successfully" ✅




3 Scenarios — Provision Kab Hota Hai?
Scenario A: api_url pehle se set hai (recommended)

POST /api/v1/brokers call karo with api_url in body
          │
          ▼
Broker create hota hai + provision automatic fire hota hai
          │
          ▼
VPS pe manager account bhi ban jaata hai
Response aate hi broker staff login kar sakta hai ✅


Scenario B: api_url baad mein set kiya

POST /api/v1/brokers call karo (api_url nahi diya)
          │
          ▼
Broker ban jaata hai, credentials SuperAdmin DB mein save hain
But VPS pe account nahi bana abhi
          │
          ▼ (VPS deploy ho jaane ke baad)
PUT /api/v1/brokers/my_broker
Body: { "api_url": "http://103.91.186.142:8091" }
          │
          ▼
POST /api/v1/brokers/my_broker/reset-manager-password
Body: {}
          │
          ▼
Password reset + provision fires → VPS pe account ban jaata hai ✅


Scenario C: VPS down tha provision ke time

Provision call fail hoti hai (VPS unreachable/not deployed yet)
          │
          ▼
Password SuperAdmin DB mein safe hai (fail nahi hota)
Logs mein warning aata hai (non-fatal)
          │
          ▼ (VPS ready hone ke baad)
Dobara call karo:
POST /api/v1/brokers/my_broker/reset-manager-password
          │
          ▼
Provision retry hota hai → VPS pe account ban jaata hai ✅




Broker Admin Login Kaise Karta Hai?
Provision successful hone ke baad, broker staff apne Manager Panel mein login kar sakta hai:

POST http://103.91.186.142:8091/api/v2/auth/login
Content-Type: application/json

{
  "user":     "10016",       ← login number (string mein)
  "password": "Broker@A3F9...",
  "server":   "my_broker"   ← BROKER_ID same as in SuperAdmin
}

          │
          ▼
Success Response:
{
  "token":         "2df7c23f-62e9-...",
  "refresh_token": "848a6a12-0480-...",
  "login":         10016,
  "is_admin":      true,
  "broker_id":     "my_broker"
}


Token mil gaya — broker admin ab sab kuch kar sakta hai ✅


Complete Flow — Ek Page Mein

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  STEP 1: SuperAdmin Panel mein broker create karo               │
│                                                                 │
│  POST /api/v1/brokers                                           │
│  { broker_id, name, server_ip, api_url, license_plan }          │
│                                │                                │
│                   ┌────────────┴────────────┐                  │
│                   ▼                         ▼                  │
│            LICENSE KEY               MANAGER CREDENTIALS        │
│     "RTX5-ENT-MYBRO-2026-..."        login: 10016               │
│                   │                  password: "Broker@..."     │
│                   │                         │                  │
└───────────────────┼─────────────────────────┼──────────────────┘
                    │                         │
                    ▼                         ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│  STEP 2: License Key           │  │  STEP 3: Credentials          │
│  GitHub Secret mein daalo      │  │  VPS ko provision hoti hai    │
│                                │  │                              │
│  BROKER_ENV_MYBROKER secret:   │  │  Automatic hota hai if        │
│                                │  │  api_url set hai              │
│  BROKER_ID=my_broker           │  │                              │
│  RTX5_LICENSE_KEY=RTX5-ENT-... │  │  Ya manually:                │
│                                │  │  POST /reset-manager-password│
└───────────────┬────────────────┘  └──────────────┬───────────────┘
                │                                  │
                ▼                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│  STEP 4: CI/CD Push karo (git push origin main)                   │
│                                                                   │
│  Build GHCR Images → Deploy Brokers → pre-deploy.sh runs         │
│                                                                   │
│  .env mein jaata hai:                                             │
│    RTX5_LICENSE_KEY → license-agent validate karta hai            │
│    SUPER_ADMIN_PUBLIC_KEY_B64 → provision JWT verify karta hai    │
│    BROKER_ID → sab services ko pata hota hai kaun sa broker hai   │
└───────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────┐
│  STEP 5: Test karo                                                │
│                                                                   │
│  License OK?                                                      │
│  docker logs rtx5-license-agent | grep "License validated"        │
│                                                                   │
│  Manager Login OK?                                                │
│  POST :8091/api/v2/auth/login                                     │
│  { user:"10016", password:"Broker@...", server:"my_broker" }      │
│                                                                   │
│  ✅ Token mila = sab kuch kaam kar raha hai                       │
└───────────────────────────────────────────────────────────────────┘




Credentials Retrieve Karna (Baad Mein)
Broker ne password bhula diya? Ya nayi deployment ke baad dobara chahiye?

GET /api/v1/brokers/my_broker/manager-credentials
Authorization: Bearer <superadmin-token>

Response:
{
  "broker_id":   "my_broker",
  "broker_name": "My Broker Ltd",
  "server_ip":   "103.91.186.142",
  "manager_credentials": {
    "login":      10016,
    "password":   "Broker@A3F9D2E1B8C4...",   ← plaintext (decrypted)
    "name":       "My Broker Ltd Admin",
    "role":       "super_admin",
    "updated_at": 1779971434
  }
}




Password Reset Karna

POST /api/v1/brokers/my_broker/reset-manager-password
Authorization: Bearer <superadmin-token>
Content-Type: application/json

{}    ← empty = auto-generate new password

Ya specific password:
{ "password": "MyNewPass123!" }   ← min 8, max 72 characters

Response:
{
  "auto_generated": true,
  "manager_credentials": {
    "login":    10016,
    "password": "Broker@NEW_PASS_HERE",
    ...
  }
}


Reset karne ke baad:

SuperAdmin DB mein naya password save ho jaata hai
Provision automatically fire hoti hai broker VPS pe
Purana password kaam karna band ho jaata hai


Summary Table — Kya Kahan Jaata Hai

Cheez	Source	Kahan Jaata Hai	Kaise Use Hota Hai
RTX5_LICENSE_KEY	Create broker response	BROKER_ENV_<NAME> GitHub Secret → /opt/rtx5/.env	license-agent isko SuperAdmin se validate karta hai
BROKER_ID	Jo tumne set kiya create karte waqt	BROKER_ENV_<NAME> GitHub Secret → /opt/rtx5/.env	Sab services ko pata hota hai kaun sa broker hai
manager login (number)	Auto-generated by SuperAdmin	Create broker response mein milta hai	Broker staff ka username
manager password	Auto-generated by SuperAdmin	Provision ke zariye broker VPS pe jaata hai	Broker staff Manager Panel mein isse login karta hai
SUPER_ADMIN_PUBLIC_KEY_B64	CI/CD injects automatically	/opt/rtx5/.env	Provision JWT verify karta hai



Important Rules (Bhoolna Mat)

✅ BROKER_ID must match exactly:
   SuperAdmin mein: broker_id = "my_broker"
   .env mein:       BROKER_ID = "my_broker"
   Seed migration:  broker_id = 'my_broker'
   Manager login:   server = "my_broker"
   Sab ek jaisi string honi chahiye. Ek bhi alag = problem.

✅ RTX5_LICENSE_KEY wahi daalo jo SuperAdmin ne return kiya:
   Create broker → response → license_key field
   Wahi key copy karo, wahi .env mein daalo.

✅ api_url zaroor set karo:
   Bina api_url ke provision nahi hoga.
   Bina provision ke broker staff login nahi kar payega.

✅ Provision non-fatal hai:
   Agar VPS ready nahi tha to koi baat nahi.
   VPS deploy hone ke baad reset-manager-password call karo.
   Password dobara push ho jaayega.




New Broker Onboarding — Checklist

SUPERADMIN SIDE
  □ POST /api/v1/brokers call kiya (sab fields ke saath)
  □ Response se license_key copy kar liya
  □ Response se manager login + password copy kar liya
  □ api_url set hai (http://<VPS_IP>:8091)

BROKER VPS SIDE
  □ BROKER_ENV_<NAME> GitHub Secret banaya
  □ BROKER_ID = <same as SuperAdmin broker_id> .env mein add kiya
  □ RTX5_LICENSE_KEY = <response se copy kiya key> .env mein add kiya
  □ brokers.json mein broker entry add ki
  □ Seed migration create ki (broker_id same as SuperAdmin)
  □ git push kiya → CI/CD deploy hua

VERIFICATION
  □ License OK: docker logs rtx5-license-agent → "License validated successfully"
  □ Manager login OK: POST :8091/api/v2/auth/login → token aaya
  □ Credentials broker ko de diye:
      Login:    10016
      Password: Broker@...
      Server:   <VPS IP>



