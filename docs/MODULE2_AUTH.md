# Module 2 — Authentication

## What this module delivers

Register, login, logout, silent session refresh (rotating refresh token +
reuse detection), role-based access control (admin/lawyer/researcher/student),
and a profile view/edit screen — backend and frontend, fully wired.

## Environment variables

`backend/.env` (copy from `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Frontend origin, used for CORS + cookie scoping |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Signs short-lived access tokens (default 15m) |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Signs the httpOnly refresh cookie (default 7d, 30d if "remember me") |
| `REFRESH_TOKEN_COOKIE_NAME` | Cookie name for the refresh token |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Throttles `/register` and `/login` |

`frontend/.env` (copy from `frontend/.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API base, e.g. `http://localhost:5000/api` |

## Install & run

```bash
# MongoDB must be running locally (or point MONGO_URI at Atlas)

cd backend
cp .env.example .env   # fill in real secrets
npm install
npm run dev             # http://localhost:5000

cd ../frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

## API reference

Base URL: `http://localhost:5000/api`

### `POST /auth/register`
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "fullName": "Anita Rao",
    "email": "anita@example.com",
    "password": "StrongPass1!",
    "confirmPassword": "StrongPass1!",
    "role": "lawyer"
  }'
```
Returns `201` with `{ user, accessToken }` and sets the refresh cookie.

### `POST /auth/login`
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "email": "anita@example.com", "password": "StrongPass1!", "rememberMe": true }'
```

### `GET /auth/me`
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### `POST /auth/refresh`
```bash
curl -X POST http://localhost:5000/api/auth/refresh -b cookies.txt -c cookies.txt
```
Rotates the refresh token and returns a new `accessToken` + `user`.

### `POST /auth/logout`
```bash
curl -X POST http://localhost:5000/api/auth/logout -b cookies.txt
```

### `PUT /users/profile`
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{ "fullName": "Anita R. Rao" }'
```

## Testing checklist

- [ ] Register with a weak password → 422 with field-level errors
- [ ] Register twice with the same email → 409 conflict
- [ ] Login with wrong password → 401 (generic "Invalid email or password", doesn't reveal which field was wrong)
- [ ] Hit `/login` 11 times quickly → 429 rate limited
- [ ] Reload the app while logged in → session resumes silently via `/auth/refresh`, no re-login needed
- [ ] Log out → refresh cookie cleared, `/auth/me` now returns 401
- [ ] Call `/auth/refresh` twice with the same (already-rotated) cookie → second call is rejected and the session is killed (reuse detection)
- [ ] Edit full name / avatar on the profile page → persists after reload

## Known scope limits (intentional, not bugs)

- No email-based password reset yet — needs a transactional email provider, tracked as a follow-up. The "Forgot password?" link goes to a page that says so rather than pretending to work.
- `isVerified` exists on the User model for a future email-verification flow but isn't enforced anywhere yet — logging in doesn't require it.
- Refresh tokens are single-session (one active refresh token per user, rotated each use). Logging in on a second device invalidates the first device's session. Multi-device sessions would need an array of token hashes instead of one field — a reasonable v2 change, not done here to keep the model simple for a student project.
