# Keycloak Quickstart (Docker Compose)

This repository includes an optional Keycloak container to make SSO login easy for anyone running `docker compose up`.

## What this gives you

- A Keycloak server published at http://localhost:8080
- A pre-imported realm: `socoles`
- A pre-created OIDC client: `socoles-frontend` (confidential)
- Valid redirect URIs (local):
  - http://localhost:3000/api/auth/callback/*
  - http://127.0.0.1:3000/api/auth/callback/*
- Post logout redirect URI: http://localhost:3000/

No `/etc/hosts` entry is required. The browser uses `localhost:8080`; the frontend container uses `keycloak:8080` on the Docker network.

## Environment variables

In `.env` (copied from `.env.example`), set:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<a-long-random-string>
KEYCLOAK_ISSUER=http://keycloak:8080/realms/socoles
KEYCLOAK_ISSUER_PUBLIC=http://localhost:8080/realms/socoles
KEYCLOAK_CLIENT_ID=socoles-frontend
KEYCLOAK_CLIENT_SECRET=change-me
KEYCLOAK_LOGOUT_REDIRECT_URI=http://localhost:3000/
```

You can change the Keycloak admin credentials by setting `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` in `.env`.

## Start services

```
docker compose up -d
```

Open the admin console at http://localhost:8080/ and login with the admin credentials. You’ll see the `socoles` realm and `socoles-frontend` client imported.

The realm has no predefined users. Use the **Register** option on the Keycloak login page to create one.

## Production notes

- Replace `http://localhost:3000` with your public origin (e.g., `https://socoles.cs.ru.nl`) in NEXTAUTH_URL and KEYCLOAK_LOGOUT_REDIRECT_URI.
- Update the client’s Valid Redirect URIs and Post Logout Redirect URIs to match your domain.
- Rotate `NEXTAUTH_SECRET` to a long, random value and keep it stable.
- Change the Keycloak client secret and admin credentials.
