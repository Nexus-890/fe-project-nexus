# Profile verification with the real backend

The profile page uses the running user-service through the API gateway and the
Next.js proxy. Start these applications manually. The browser verification
command connects to the running application; it must not start a replacement
backend or silently launch services on other ports.

## Local configuration

The current development environment selects these existing PostgreSQL databases
in `be-project-nexus/infra/local-dev/.env`:

```properties
USER_DB_NAME=nexus_demo_user_db
CATALOG_DB_NAME=nexus_demo_catalog_db
COMMERCE_DB_NAME=nexus_demo_commerce_db
```

They contain real persisted records loaded by Flyway and the SQL files in
`be-project-nexus/infra/demo/`. The original `user_db`, `catalog_db`, and
`commerce_db` remain separate. Profile writes go to `nexus_demo_user_db`.
Do not change Flyway history to make the original catalog database start.

The frontend's `fe-project-nexus/.env.local` uses:

```properties
NEXT_PUBLIC_API_URL=
API_PROXY_TARGET=http://localhost:8080
```

Browser requests stay on the Next.js origin and are forwarded to the gateway.
No frontend password or bearer token belongs in these environment files.

## Manual startup

1. Start the existing local Docker infrastructure and confirm PostgreSQL, Kafka,
   and Redis are available. Keep the database credentials and JWT key paths in
   the existing backend local environment file.
2. If shared libraries changed, open `be-project-nexus/lib` and run
   `.\mvnw.cmd '-Dmaven.test.skip=true' install` once.
3. Open one terminal per backend service, with its working directory set to
   `be-project-nexus/<service>`. Run
   `.\mvnw.cmd '-Dmaven.test.skip=true' spring-boot:run`, or run the service's
   application class from an IDE with that same working directory. Start Config
   Server and Discovery first, then user-service, catalog-service,
   commerce-service, and the gateway.
4. Confirm the expected ports below. If a port is occupied, inspect the existing
   process and use or stop it explicitly before starting another instance.
5. In `fe-project-nexus`, run `npm run dev` in a visible terminal. Open
   `http://localhost:3000` and keep that origin for the session.

| Application | Port |
| --- | --- |
| Config Server | 8888 |
| Discovery | 8761 |
| user-service | 8081 |
| catalog-service | 8082 |
| commerce-service | 8083 |
| API gateway | 8080 |
| Next.js | 3000 |

The service working directory matters: each business service imports
`../infra/local-dev/.env` and obtains its database-name setting there. Restart
Config Server after changing its YAML resources, and restart the clients after
changing their local environment.

## Check the profile flow

1. Open `/profile` while signed out and confirm navigation to `/sign-in`.
2. Sign in with the seeded `buyer@nexus.local` account using the local demo
   password documented with the seed. In browser Network, verify
   `POST /api/v1/auth/login` returns 200 and the authenticated
   `GET /api/v1/users/me` returns 200.
3. Click the header account name to open `/profile`. Compare the displayed name,
   email, phone, gender, address, and birth date with the GET response. Phone is
   read-only because `UpdateProfileRequest` does not accept phone changes.
4. Record the current profile values. Edit a supported field and save. Verify
   `PUT /api/v1/users/me` returns 200, the form reflects the returned record,
   and a name change also updates the header. Restore the original values and
   save again after the check.
5. Edit a field and cancel. Confirm no PUT is sent and the saved values return.
6. Check a blank full name and a future birth date. Client validation should
   prevent saving. Check the page at 375×812 for horizontal overflow.

The current token is held in memory and saved as `nexus.accessToken` in
localStorage. Reload fetches `/api/v1/users/me` with the saved token and restores
the profile. Sign-out or a current-session 401 clears the token and private
cache. Passwords are not saved in localStorage. Avatar upload, password changes,
reputation, and penalties still await their backend contracts.

With the application and real backend already running, execute
`npm run test:profile` from `fe-project-nexus` for the current browser suite.
Its results apply to that run and its configured application origin.

## Recorded real API evidence

The 21 October 2026 live browser check received login 200, profile GET 200, and
profile PUT 200 through the gateway. The profile form populated from the backend
and reflected the successful response; temporary profile edits were restored.
All 5 real browser scenarios passed in 13.6 seconds at `http://localhost:3000`:

1. Anonymous profile access redirects to sign-in.
2. Login and profile GET/PUT persist real data; temporary edits are restored.
3. Catalog detail and add-to-cart use persisted PostgreSQL data.
4. Reload restores login from localStorage; sign-out removes the saved token.
5. An invalid saved token receives a real 401 and is removed.

`npm run test:auth` passed 45 unit tests after the thumbnail update, including storage and SSR checks.
Direct HTTP verification also covered these endpoints as part of all 19 API
rows marked TRUE in the workbook. These observations do not establish browser
integration for APIs without a frontend screen.

See [the API integration audit](api-integration-audit.md) for endpoint coverage
and limitations. Detailed generated HTTP reports remain local and are excluded
from Git. No previous browser-fixture result or
historical screenshot is counted as evidence for this real backend flow.
