# TalentPulse Aggregate Connector for Odoo Community 19

Preparatory module for a **self-hosted Odoo Community 19.0 instance**. It has not yet been installed or verified in a running Odoo database. Adding the source to this repository does not connect the public TalentPulse demo to Odoo.

An Odoo Settings administrator can configure one connection per TalentPulse position and click **Fetch aggregates**. The module makes one read-only HTTPS request to the existing TalentPulse aggregate export. It stores the position ID, title, description, published CV count and attribute statistics. It does not import candidate profiles, personal CV objects, or the raw response; it does not create Odoo contacts/applicants, send emails, run a cron job, or push data to TalentPulse.

## Requirements

- Your own running **Odoo Community 19.0** server and its PostgreSQL database, with permission to install addons. The software license is free; a hosted server is separate.
- A reachable TalentPulse HTTPS backend on port 443 with its database working and aggregate export enabled. This module uses `/api/external/odoo/position-data/{position-token}`, not Odoo's external API.
- A position token obtained through a real authenticated position owner, or a real administrator whose stable user ID is configured in TalentPulse `INTEGRATION_OPERATOR_IDS`. Anonymous visitors and demo accounts do not receive these tokens in position responses. Follow the backend's integration configuration instructions for `ODOO_ENABLED` and a strong `JWT_SECRET`.
- Administrator access to Odoo Settings. Ordinary internal/portal/public users receive no model access.

Odoo Online **One App Free** and **Standard** do not include the supported external API. Online also does not permit custom Python modules, so this addon cannot be installed there. Odoo Online Custom can use a separate external API client, but cannot run this Python addon. Do not purchase or enable a paid plan just to test this source.

Official references: [Odoo editions and installation](https://www.odoo.com/documentation/19.0/administration.html), [source installation](https://www.odoo.com/documentation/19.0/administration/on_premise/source.html), [Online limitations](https://www.odoo.com/documentation/19.0/administration/odoo_online.html), [external API plan requirement](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html).

## Install and configure

1. Copy this `talentpulse_connector` directory into your own Odoo addons directory, or add the repository's `odoo_addons` directory to `--addons-path`. Keep Odoo's original addon paths too.
2. Restart Odoo. Enable developer mode, open **Apps**, update the apps list, and install **TalentPulse Aggregate Connector**. Alternatively install against an existing test database with `odoo-bin -d YOUR_TEST_DB -i talentpulse_connector --stop-after-init --addons-path=YOUR_ORIGINAL_PATHS,/absolute/path/to/odoo_addons`.
3. As a Settings administrator, open **TalentPulse → Position aggregates**, create a connection and enter a name, the backend **origin** (for example `https://your-backend.example.com`, without `/api`, credentials, query or fragment), and the position's UUID token. Save it.
4. Click **Fetch aggregates**. Check the position summary, statistics and last-fetched timestamp. If the free demo backend is asleep, start it and retry; the request has bounded socket timeouts.
5. To stop using the connector, remove the connection record and revoke/rotate its position token on the TalentPulse side. Because tokens may have appeared in older public responses, rotate previously exposed tokens before using real information.

The token field is masked in the form and restricted to Settings administrators, but is **stored in the Odoo database, not encrypted by this module**. Restrict database/backup access. The current TalentPulse export puts its token in the request path; configure backend/proxy access logs to redact that route. Never put real tokens in this README, screenshots, tickets, or version control.

Only aggregate fields are saved, but categorical statistics and position text can still contain sensitive source values. Use synthetic/demo data for public demonstrations, and publish only attributes appropriate for the intended Odoo administrators.

## Network behavior

Only HTTPS origins on port 443 are accepted. TLS certificates are verified. Private/loopback/link-local/reserved addresses are rejected, including mixed public/private DNS answers; the validated numeric address is pinned for the socket connection. Redirects are not followed, environment HTTP proxies are not used, and responses are limited to 1 MiB. Connect/read timeouts are 3/10 seconds. Errors shown to users omit remote bodies, URLs and tokens. Internal-only TalentPulse servers intentionally require a separately reviewed transport configuration.

## Verification

The repository includes Python unit tests for URL/DNS restrictions, the pinned-IP transport, response filtering, size/error handling, and a mocked GET request. These run without installing Odoo:

```sh
python -m unittest discover -s odoo_addons/talentpulse_connector/tests -v
python -m compileall -q odoo_addons/talentpulse_connector
```

These checks do **not** verify Odoo installation, view rendering, ORM access rights, or a live TalentPulse → Odoo exchange. Before describing the integration as connected, perform the following in a disposable Odoo Community 19 test database:

1. Install the addon with no XML/ACL errors and confirm that a Settings administrator can create a connection.
2. Use a synthetic TalentPulse position; fetch it, compare its published CV count/min/max/average with the source, and confirm the timestamp changes.
3. Verify an ordinary internal user and a portal user cannot list/read/create/write the connection model or call `action_fetch_aggregates` through RPC.
4. Verify an invalid/revoked token, private URL, redirect, timeout and unavailable backend leave the previous successful summary unchanged and display a safe error.
5. Confirm there are no scheduled actions and no automatic requests after module installation or connection creation.
