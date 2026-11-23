"""Verify the deployed login page through nginx, including each local stylesheet
and Next.js script that a browser needs to render and run it."""

import sys
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import urlopen


class LoginAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "stylesheet" in (attrs.get("rel") or "").lower().split():
            path, kind = attrs.get("href"), "css"
        elif tag == "script":
            path, kind = attrs.get("src"), "js"
        else:
            return
        if path and path.startswith("/_next/static/"):
            self.assets[path] = kind


def check(site):
    page = urljoin(site, "/ru/login")
    parser = LoginAssets()
    with urlopen(page, timeout=15) as response:
        if response.status != 200 or response.headers.get_content_type() != "text/html":
            return f"{page} returned {response.status} {response.headers.get_content_type()}"
        parser.feed(response.read().decode("utf-8"))
        parser.close()
    if set(parser.assets.values()) != {"css", "js"}:
        return f"{page} must reference both CSS and JavaScript"

    types = {
        "css": {"text/css"},
        "js": {"text/javascript", "application/javascript", "application/x-javascript"},
    }
    for path, kind in parser.assets.items():
        url = urljoin(page, path)
        with urlopen(url, timeout=15) as response:
            content_type = response.headers.get_content_type()
            if response.status != 200 or content_type not in types[kind]:
                return f"{path} returned {response.status} {content_type}"
            if not response.read(1):
                return f"{path} returned an empty body"
    print(f"Verified {len(parser.assets)} assets on {urlsplit(site).netloc}")


if __name__ == "__main__":
    try:
        sys.exit(check(sys.argv[1]))
    except HTTPError as error:
        sys.exit(f"{error.url} returned HTTP {error.code}")
    except (URLError, OSError) as error:
        sys.exit(str(error))
