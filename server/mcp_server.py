from __future__ import annotations

import asyncio
import json
import sys

from server.app.services.mcp_http import HttpMCPService


def send(message: dict) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    service = HttpMCPService()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        response = asyncio.run(service.handle_jsonrpc(request))
        send(response)


if __name__ == "__main__":
    main()
