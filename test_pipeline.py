#!/usr/bin/env python3
"""
Standalone integration test for the Fact & Claim Verification System.

Usage:
    # Test with a URL
    python test_pipeline.py --url https://www.bbc.com/news/some-article

    # Test with raw text
    python test_pipeline.py --text "The Eiffel Tower is 330 meters tall and located in Paris."

    # Default: uses built-in sample text
    python test_pipeline.py
"""

import argparse
import json
import sys
import time

import requests

BASE_URL = "http://localhost:8000/api"
MAX_POLL_SECONDS = 300  # 5-minute timeout

SAMPLE_TEXT = (
    "The Eiffel Tower is located in Paris, France, and stands 330 meters tall. "
    "It was built in 1889 as the entrance arch for the 1900 World's Fair. "
    "The tower attracts around 7 million visitors per year, making it the most "
    "visited paid monument in the world. The Eiffel Tower was designed by "
    "Gustave Eiffel and his engineering company."
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hr(char="=", width=70):
    print(char * width)


def _section(title):
    _hr()
    print(f"  {title}")
    _hr()
    print()


def _verdict_icon(verdict):
    return {"true": "✅", "false": "❌", "partially_true": "⚠️", "unverifiable": "❓"}.get(verdict, "?")


# ── API calls ─────────────────────────────────────────────────────────────────

def submit_job(content: str, input_type: str) -> str | None:
    _section("SUBMITTING VERIFICATION JOB")
    print(f"Input type : {input_type}")
    print(f"Content    : {content[:120]}{'...' if len(content) > 120 else ''}\n")

    try:
        resp = requests.post(
            f"{BASE_URL}/verify/",
            json={"input_type": input_type, "content": content},
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        print("❌  Could not connect to server. Is 'python manage.py runserver' running?")
        return None

    if resp.status_code == 201:
        job_id = resp.json()["job_id"]
        print(f"✅  Job created: {job_id}")
        return job_id

    print(f"❌  HTTP {resp.status_code}: {resp.text}")
    return None


def poll_job(job_id: str) -> dict | None:
    _section("POLLING JOB STATUS")
    start = time.time()

    while True:
        elapsed = int(time.time() - start)
        if elapsed > MAX_POLL_SECONDS:
            print(f"❌  Timed out after {MAX_POLL_SECONDS}s")
            return None

        resp = requests.get(f"{BASE_URL}/jobs/{job_id}/", timeout=10)
        if resp.status_code != 200:
            print(f"❌  HTTP {resp.status_code}")
            return None

        data = resp.json()
        job_status = data["status"]
        print(f"[{elapsed:>3}s]  status = {job_status}")

        if job_status == "complete":
            print("\n✅  Job complete.\n")
            return data
        if job_status == "failed":
            print(f"\n❌  Job failed: {data.get('error_message', 'unknown error')}")
            return None

        time.sleep(3)


# ── Display ───────────────────────────────────────────────────────────────────

def display_report(job: dict) -> None:
    _section("ACCURACY REPORT")

    report = job.get("report")
    if not report:
        print("No report available.")
        return

    print(f"Overall accuracy score : {report['overall_score']:.1%}")
    print(f"  ✅  True             : {report['true_count']}")
    print(f"  ❌  False            : {report['false_count']}")
    print(f"  ⚠️   Partially true  : {report['partially_true_count']}")
    print(f"  ❓  Unverifiable     : {report['unverifiable_count']}")

    if report.get("ai_text_probability") is not None:
        print(f"\nAI-text probability    : {report['ai_text_probability']:.1%}")
        indicators = report.get("ai_text_indicators") or []
        if indicators:
            print(f"AI indicators          : {', '.join(indicators[:4])}")

    claims = job.get("claims", [])
    if claims:
        print(f"\n{'─'*70}")
        print(f"  Claims ({len(claims)} total)")
        print(f"{'─'*70}")
        for i, c in enumerate(claims, 1):
            icon = _verdict_icon(c["verdict"])
            print(f"\n  {i}. {c['claim_text']}")
            print(f"     {icon}  {c['verdict'].upper()}  |  confidence: {c['confidence_score']:.0%}  |  sources: {len(c['sources'])}")

    images = job.get("image_analyses", [])
    analyzed = [img for img in images if img["status"] == "analyzed"]
    if analyzed:
        print(f"\n{'─'*70}")
        print(f"  Images analyzed ({len(analyzed)})")
        print(f"{'─'*70}")
        for img in analyzed:
            label = "🤖 AI-generated" if img["is_ai_generated"] else "📸 Appears real"
            print(f"  {label}  |  confidence: {img['confidence']:.0%}  |  deepfake: {img['deepfake_probability']:.0%}")

    _hr()
    print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Test the fact-check pipeline")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--url", help="URL to fact-check")
    group.add_argument("--text", help="Raw text to fact-check")
    args = parser.parse_args()

    if args.url:
        content, input_type = args.url, "url"
    elif args.text:
        content, input_type = args.text, "text"
    else:
        content, input_type = SAMPLE_TEXT, "text"

    job_id = submit_job(content, input_type)
    if not job_id:
        return 1

    job = poll_job(job_id)
    if not job:
        return 1

    display_report(job)
    return 0


if __name__ == "__main__":
    sys.exit(main())
