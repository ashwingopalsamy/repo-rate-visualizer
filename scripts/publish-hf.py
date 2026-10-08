#!/usr/bin/env python3
"""Publish the built datasets under hf/ to the Hugging Face Hub.

Each folder under hf/ is one dataset repo (named in its provenance/build-manifest.json). A folder is uploaded only when
its SHA256SUMS differs from the copy on the Hub, and remote files no longer produced by the build are removed in the
same commit. Needs HF_TOKEN (a write token) in the environment; --dry-run needs no token and changes nothing.

Usage: python scripts/publish-hf.py [--dry-run] [--only <folder-name> ...]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download
from huggingface_hub.errors import EntryNotFoundError, RepositoryNotFoundError

ROOT = Path(__file__).resolve().parent.parent
HF = ROOT / "hf"
KEEP_REMOTE = {".gitattributes"}


def local_files(folder: Path) -> set[str]:
    return {p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file()}


def remote_state(api: HfApi, repo_id: str) -> tuple[set[str] | None, str | None]:
    """Remote file list and SHA256SUMS text; (None, None) when the repo does not exist yet."""
    try:
        files = set(api.list_repo_files(repo_id, repo_type="dataset"))
    except RepositoryNotFoundError:
        return None, None
    try:
        sums = Path(hf_hub_download(repo_id, "SHA256SUMS", repo_type="dataset", token=api.token, force_download=True)).read_text(encoding="utf-8")
    except EntryNotFoundError:
        sums = None
    return files, sums


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="report what would change without uploading")
    ap.add_argument("--only", action="append", default=[], help="publish only this folder under hf/ (repeatable)")
    args = ap.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token and not args.dry_run:
        print("HF_TOKEN is not set; nothing published. Add a Hugging Face write token as the HF_TOKEN secret.")
        return 0
    api = HfApi(token=token)
    folders = sorted(p for p in HF.iterdir() if (p / "provenance" / "build-manifest.json").is_file())
    if args.only:
        folders = [p for p in folders if p.name in args.only]
    report = []
    for folder in folders:
        manifest = json.loads((folder / "provenance" / "build-manifest.json").read_text(encoding="utf-8"))
        repo_id = manifest["repo_id"]
        files, sums = remote_state(api, repo_id)
        local = local_files(folder)
        if sums == (folder / "SHA256SUMS").read_text(encoding="utf-8"):
            report.append({"repo": repo_id, "action": "up to date"})
            continue
        stale = sorted((files or set()) - local - KEEP_REMOTE)
        releases = ", ".join(f"{r['country_code']} {r['hash'][:12]}" for r in manifest["releases"])
        message = f"v{manifest['version']}: data through {manifest['generated_at']} ({releases})"
        entry = {"repo": repo_id, "action": "create" if files is None else "update", "files": len(local), "remove": stale, "message": message}
        report.append(entry)
        if args.dry_run:
            continue
        api.create_repo(repo_id, repo_type="dataset", private=False, exist_ok=True)
        api.upload_folder(folder_path=str(folder), repo_id=repo_id, repo_type="dataset", commit_message=message, delete_patterns=stale or None)
    print(json.dumps({"dry_run": args.dry_run, "datasets": report}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
