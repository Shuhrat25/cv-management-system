"""Run without Odoo: python -m unittest discover -s <module>/tests -v."""

import copy
import importlib.util
import json
from pathlib import Path
import socket
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location("talentpulse_client", Path(__file__).parents[1] / "client.py")
client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(client)

TOKEN = "4c9bc1d3-892a-4c7c-a0d0-1eb31d99051b"
ORIGIN = "https://talentpulse.example.com"
PAYLOAD = {
    "success": True,
    "position": {"id": "position-1", "title": "Frontend developer", "description": "Demo position", "totalSubmittedCVs": 2, "apiToken": TOKEN},
    "aggregatedResults": [
        {"attributeId": "experience", "attributeName": "Experience", "dataType": "NUMERIC", "category": "Work", "count": 2, "min": 1, "max": 3, "avg": 2},
        {"attributeId": "framework", "attributeName": "Framework", "dataType": "STRING", "category": "Work", "count": 2, "popularValues": [{"value": "React", "count": 2}]},
    ],
}


def response(status=200, payload=None, content_type="application/json"):
    result = Mock()
    result.status = status
    result.getheader.return_value = content_type
    result.read.return_value = json.dumps(PAYLOAD if payload is None else payload).encode()
    return result


class ConfigurationTests(unittest.TestCase):
    def test_valid_https_origin(self):
        self.assertEqual(client.validate_configuration(ORIGIN + "/", TOKEN), ("talentpulse.example.com", TOKEN))

    def test_unsafe_urls_and_invalid_tokens_are_rejected(self):
        for url in (
            "http://talentpulse.example.com", "https://localhost", "https://127.0.0.1", "https://10.0.0.1",
            "https://[::1]", "https://169.254.169.254", "https://user:password@talentpulse.example.com",
            ORIGIN + ":8443", ORIGIN + "/api", ORIGIN + "?token=secret", ORIGIN + "#fragment", ORIGIN + "\n",
        ):
            with self.subTest(url=url), self.assertRaises(client.ConnectorError):
                client.validate_configuration(url, TOKEN)
        with self.assertRaises(client.ConnectorError):
            client.validate_configuration(ORIGIN, "not-a-uuid")

    def test_dns_answers_must_all_be_public(self):
        public = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 443))
        private = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443))
        with patch.object(client.socket, "getaddrinfo", return_value=[public]):
            self.assertEqual(client._public_addresses("example.com"), ["1.1.1.1"])
        with patch.object(client.socket, "getaddrinfo", return_value=[public, private]):
            with self.assertRaises(client.ConnectorError):
                client._public_addresses("example.com")

    def test_connection_uses_checked_numeric_address_and_original_tls_name(self):
        context = Mock()
        raw_socket = Mock()
        connection = client._PublicHTTPSConnection("talentpulse.example.com", context=context)
        with patch.object(client, "_public_addresses", return_value=["1.1.1.1"]), \
             patch.object(client.socket, "create_connection", return_value=raw_socket) as create_socket:
            connection.connect()
        create_socket.assert_called_once_with(("1.1.1.1", 443), client.CONNECT_TIMEOUT)
        context.wrap_socket.assert_called_once_with(raw_socket, server_hostname="talentpulse.example.com")
        connection.close()


class AggregateTests(unittest.TestCase):
    def test_summary_and_statistics_are_preserved_without_token_or_raw_cvs(self):
        payload = copy.deepcopy(PAYLOAD)
        payload["cvs"] = [{"name": "Private person", "email": "private@example.com"}]
        payload["position"]["candidate"] = {"email": "private@example.com"}
        payload["aggregatedResults"][0]["candidateEmails"] = ["private@example.com"]
        clean = client.sanitize_payload(payload)
        self.assertEqual(clean["position"]["totalSubmittedCVs"], 2)
        self.assertEqual(clean["aggregatedResults"][0]["avg"], 2)
        self.assertEqual(clean["aggregatedResults"][1]["popularValues"][0]["value"], "React")
        serialized = json.dumps(clean)
        self.assertNotIn(TOKEN, serialized)
        self.assertNotIn("private@example.com", serialized)
        self.assertNotIn("Private person", serialized)

    def test_malformed_statistics_are_rejected(self):
        for value in (float("nan"), float("inf"), True, "2"):
            payload = copy.deepcopy(PAYLOAD)
            payload["aggregatedResults"][0]["avg"] = value
            with self.subTest(value=value), self.assertRaises(client.ConnectorError):
                client.sanitize_payload(payload)
        payload = copy.deepcopy(PAYLOAD)
        payload["position"]["totalSubmittedCVs"] = -1
        with self.assertRaises(client.ConnectorError):
            client.sanitize_payload(payload)


class FetchTests(unittest.TestCase):
    def test_get_only_request_and_connection_closed(self):
        with patch.object(client, "_PublicHTTPSConnection") as factory:
            connection = factory.return_value
            connection.getresponse.return_value = response()
            clean = client.fetch_aggregates(ORIGIN, TOKEN)
            self.assertEqual(clean["position"]["title"], "Frontend developer")
            args, kwargs = connection.request.call_args
            self.assertEqual(args, ("GET", "/api/external/odoo/position-data/" + TOKEN))
            self.assertNotIn("body", kwargs)
            connection.close.assert_called_once()

    def test_errors_do_not_expose_remote_details_or_token(self):
        for status in (401, 403, 404, 302, 500):
            with self.subTest(status=status), patch.object(client, "_PublicHTTPSConnection") as factory:
                factory.return_value.getresponse.return_value = response(status=status)
                with self.assertRaises(client.ConnectorError) as caught:
                    client.fetch_aggregates(ORIGIN, TOKEN)
                self.assertNotIn(TOKEN, str(caught.exception))
                self.assertNotIn(ORIGIN, str(caught.exception))
                factory.return_value.close.assert_called_once()

    def test_oversized_non_json_invalid_json_and_timeout_are_rejected(self):
        responses = [response(content_type="text/html"), response(), response()]
        responses[1].read.return_value = b"x" * (client.MAX_RESPONSE_BYTES + 1)
        responses[2].read.return_value = b"not json"
        for remote in responses:
            with patch.object(client, "_PublicHTTPSConnection") as factory:
                factory.return_value.getresponse.return_value = remote
                with self.assertRaises(client.ConnectorError):
                    client.fetch_aggregates(ORIGIN, TOKEN)
        with patch.object(client, "_PublicHTTPSConnection") as factory:
            factory.return_value.request.side_effect = TimeoutError("private URL " + TOKEN)
            with self.assertRaises(client.ConnectorError) as caught:
                client.fetch_aggregates(ORIGIN, TOKEN)
            self.assertNotIn(TOKEN, str(caught.exception))


if __name__ == "__main__":
    unittest.main()
