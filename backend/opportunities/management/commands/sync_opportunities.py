import os
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from xml.etree import ElementTree

import httpx
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from opportunities.models import Opportunity


KNOWN_TAGS = (
    "python", "django", "react", "javascript", "typescript", "java", "kotlin",
    "android", "machine learning", "ai", "data science", "cybersecurity",
    "cloud", "aws", "docker", "devops", "ui design", "figma", "sql",
)


def infer_tags(text):
    low = text.lower()
    return [tag for tag in KNOWN_TAGS if tag in low]


def local_name(url):
    host = urlparse(url).netloc.lower().replace("www.", "")
    return host or "feed"


def parse_feed(xml_text, source):
    root = ElementTree.fromstring(xml_text)
    ns = "{http://www.w3.org/2005/Atom}"
    items = []

    entries = root.findall(".//item")
    kind_atom = False
    if not entries:
        entries = root.findall(f".//{ns}entry")
        kind_atom = bool(entries)

    for entry in entries:
        if kind_atom:
            title_node = entry.find(f"{ns}title")
            link_node = entry.find(f"{ns}link")
            date_node = entry.find(f"{ns}updated") or entry.find(f"{ns}published")
            title = "".join(title_node.itertext()).strip() if title_node is not None else ""
            url = link_node.get("href", "") if link_node is not None else ""
            date_text = "".join(date_node.itertext()).strip() if date_node is not None else ""
        else:
            title_node = entry.find("title")
            link_node = entry.find("link")
            date_node = entry.find("pubDate")
            title = "".join(title_node.itertext()).strip() if title_node is not None else ""
            url = "".join(link_node.itertext()).strip() if link_node is not None else ""
            date_text = "".join(date_node.itertext()).strip() if date_node is not None else ""

        if not title:
            continue
        deadline = None
        if date_text:
            try:
                deadline = parsedate_to_datetime(date_text) if not kind_atom else datetime.fromisoformat(date_text.replace("Z", "+00:00"))
            except (TypeError, ValueError, OverflowError):
                deadline = None
        if deadline is None:
            deadline = timezone.now() + timedelta(days=30)
        if timezone.is_naive(deadline):
            deadline = timezone.make_aware(deadline)

        items.append({
            "title": title[:200],
            "kind": "hackathon" if "hackathon" in title.lower() else "workshop",
            "source": source,
            "url": url[:200],
            "skill_tags": infer_tags(title),
            "deadline": deadline,
        })
    return items


class Command(BaseCommand):
    help = "Sync opportunity feeds declared in OPPORTUNITY_FEEDS"

    def handle(self, *args, **options):
        feeds = [v.strip() for v in os.environ.get("OPPORTUNITY_FEEDS", "").split(",") if v.strip()]
        if not feeds:
            raise CommandError("Set OPPORTUNITY_FEEDS to one or more RSS/Atom URLs")

        imported = 0
        for feed in feeds:
            try:
                response = httpx.get(feed, timeout=15, follow_redirects=True)
                response.raise_for_status()
                rows = parse_feed(response.text, local_name(feed))
            except (httpx.HTTPError, ElementTree.ParseError) as exc:
                self.stderr.write(f"Skipped {feed}: {exc}")
                continue

            for row in rows:
                if row["deadline"] < timezone.now():
                    continue
                Opportunity.objects.update_or_create(
                    title=row["title"],
                    source=row["source"],
                    deadline=row["deadline"],
                    defaults=row,
                )
                imported += 1

        self.stdout.write(f"Synced {imported} opportunity events")
