"""Small HTTPS pull client; deliberately independent of the Odoo runtime."""

import http.client
import ipaddress
import json
import math
import socket
import ssl
from urllib.parse import urlsplit
from uuid import UUID

MAX_RESPONSE_BYTES = 1024 * 1024
CONNECT_TIMEOUT = 3
READ_TIMEOUT = 10


class ConnectorError(Exception):
    """A message safe to display without a remote URL, token, or response body."""


def validate_configuration(base_url, position_token):
    """Accept a public HTTPS origin and the UUID token used by TalentPulse."""
    if not isinstance(base_url, str) or not base_url:
        raise ConnectorError("Enter the TalentPulse backend HTTPS origin.")
    if len(base_url) > 2048 or any(char.isspace() or ord(char) < 32 for char in base_url):
        raise ConnectorError("The backend URL contains unsupported characters.")
    try:
        parsed = urlsplit(base_url)
        if (
            parsed.scheme.lower() != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port not in (None, 443)
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
            or "\\" in base_url
        ):
            raise ValueError
        host = parsed.hostname.encode("idna").decode("ascii").lower()
        if len(host) > 253 or host == "localhost" or host.endswith(".localhost"):
            raise ValueError
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            if any(not label or len(label) > 63 for label in host.split(".")):
                raise ValueError
        else:
            if not _is_public(address):
                raise ValueError
        token = str(UUID(position_token))
    except (ValueError, TypeError, UnicodeError, AttributeError):
        raise ConnectorError(
            "Use an HTTPS origin on port 443, without credentials, path, query or fragment, "
            "and a valid position UUID token."
        ) from None
    return host, token


def _is_public(address):
    return address.is_global and not address.is_multicast and not address.is_unspecified


def _public_addresses(host):
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        addresses = list(dict.fromkeys(record[4][0] for record in records))
        if not addresses or any(not _is_public(ipaddress.ip_address(ip)) for ip in addresses):
            raise ConnectorError("The backend must resolve only to public internet addresses.")
        return addresses
    except (OSError, ValueError):
        raise ConnectorError("The backend hostname could not be resolved safely.") from None


class _PublicHTTPSConnection(http.client.HTTPSConnection):
    """Connect to checked numeric IPs while verifying TLS for the original host.

    The DNS answer is pinned for the connection: a second resolver lookup cannot
    redirect the request to a private address between validation and connect.
    """

    def connect(self):
        # Validate every DNS answer, but do not let many addresses multiply the
        # connection timeout indefinitely.
        for address in _public_addresses(self.host)[:2]:
            raw_socket = None
            try:
                raw_socket = socket.create_connection((address, 443), CONNECT_TIMEOUT)
                self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)
                self.sock.settimeout(READ_TIMEOUT)
                return
            except OSError:
                if raw_socket is not None:
                    raw_socket.close()
        raise ConnectorError("The HTTPS backend could not be reached securely.")


def _text(value, limit, required=False):
    if not isinstance(value, str) or len(value) > limit or (required and not value):
        raise ConnectorError("The backend returned an invalid aggregate export.")
    return value


def _count(value):
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 2147483647:
        raise ConnectorError("The backend returned an invalid aggregate count.")
    return value


def sanitize_payload(payload):
    """Whitelist summary/statistic fields; never save a raw response or CV list."""
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise ConnectorError("The backend did not return a successful aggregate export.")
    position = payload.get("position")
    aggregates = payload.get("aggregatedResults")
    if not isinstance(position, dict) or not isinstance(aggregates, list) or len(aggregates) > 1000:
        raise ConnectorError("The backend returned an invalid aggregate export.")
    summary = {
        "id": _text(position.get("id"), 128, required=True),
        "title": _text(position.get("title"), 1024, required=True),
        "description": _text(position.get("description", ""), 16000),
        "totalSubmittedCVs": _count(position.get("totalSubmittedCVs")),
    }
    clean_aggregates = []
    for item in aggregates:
        if not isinstance(item, dict):
            raise ConnectorError("The backend returned an invalid aggregate export.")
        clean = {
            "attributeId": _text(item.get("attributeId"), 128, required=True),
            "attributeName": _text(item.get("attributeName"), 1024, required=True),
            "dataType": _text(item.get("dataType"), 64, required=True),
            "category": _text(item.get("category"), 1024),
            "count": _count(item.get("count")),
        }
        for key in ("min", "max", "avg"):
            if key in item:
                value = item[key]
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise ConnectorError("The backend returned an invalid numeric aggregate.")
                try:
                    valid_number = math.isfinite(value)
                except OverflowError:
                    valid_number = False
                if not valid_number:
                    raise ConnectorError("The backend returned an invalid numeric aggregate.")
                clean[key] = value
        if "popularValues" in item:
            values = item["popularValues"]
            if not isinstance(values, list) or len(values) > 3:
                raise ConnectorError("The backend returned an invalid aggregate export.")
            clean["popularValues"] = []
            for value in values:
                if not isinstance(value, dict):
                    raise ConnectorError("The backend returned an invalid aggregate export.")
                clean["popularValues"].append({
                    "value": _text(value.get("value"), 8000),
                    "count": _count(value.get("count")),
                })
        clean_aggregates.append(clean)
    return {"position": summary, "aggregatedResults": clean_aggregates}


def fetch_aggregates(base_url, position_token):
    host, token = validate_configuration(base_url, position_token)
    connection = _PublicHTTPSConnection(
        host, timeout=READ_TIMEOUT, context=ssl.create_default_context()
    )
    try:
        connection.request(
            "GET", "/api/external/odoo/position-data/" + token,
            headers={"Accept": "application/json", "User-Agent": "TalentPulse-Odoo/19.0", "Connection": "close"},
        )
        response = connection.getresponse()
        if response.status in (401, 403, 404):
            raise ConnectorError("The position token is invalid, revoked, or unavailable.")
        if 300 <= response.status < 400:
            raise ConnectorError("The backend redirected the request; use its final HTTPS origin.")
        if response.status != 200:
            raise ConnectorError("The backend is unavailable. Retry after it has started.")
        content_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json" and not content_type.endswith("+json"):
            raise ConnectorError("The backend did not return JSON.")
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ConnectorError("The aggregate response exceeded the 1 MiB size limit.")
        return sanitize_payload(json.loads(body))
    except ConnectorError:
        raise
    except (OSError, ssl.SSLError, http.client.HTTPException):
        raise ConnectorError("The HTTPS request failed or timed out. Check the backend and retry.") from None
    except (ValueError, UnicodeError, RecursionError):
        raise ConnectorError("The backend returned invalid JSON.") from None
    finally:
        connection.close()
