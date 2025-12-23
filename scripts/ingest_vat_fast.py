#!/usr/bin/env python3
"""
Build documents.json from VAT markdown and trigger RAG indexing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime
from typing import Dict, List

import requests


ALLOWED_EXTS = {".md", ".txt", ".csv", ".json"}


def _compute_hash(title: str, content: str, correspondent: str) -> str:
    payload = f"{title}{content}{correspondent}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _collect_documents(vat_dir: str) -> List[Dict]:
    documents = []
    correspondent = "VAT Internal"
    tags = ["vat", "internal", "austrian", "linz"]

    for root, _, files in os.walk(vat_dir):
        for name in files:
            ext = os.path.splitext(name)[1].lower()
            if ext not in ALLOWED_EXTS:
                continue

            full_path = os.path.join(root, name)
            try:
                with open(
                    full_path, "r", encoding="utf-8", errors="ignore"
                ) as handle:
                    content = handle.read()
            except OSError:
                continue

            if not content.strip():
                continue

            rel_path = os.path.relpath(full_path, vat_dir)
            title = os.path.splitext(rel_path)[0]
            created = datetime.fromtimestamp(
                os.path.getmtime(full_path)
            ).isoformat()
            doc_hash = _compute_hash(title, content, correspondent)

            documents.append(
                {
                    "id": f"vat-{doc_hash[:16]}",
                    "title": title,
                    "content": content,
                    "correspondent": correspondent,
                    "created": created,
                    "tags": tags,
                    "last_updated": created,
                    "hash": doc_hash,
                }
            )

    return documents


def _merge_documents(existing: List[Dict], incoming: List[Dict]) -> List[Dict]:
    seen_ids = {str(doc.get("id")) for doc in existing}
    seen_hashes = {doc.get("hash") for doc in existing}
    merged = list(existing)

    for doc in incoming:
        doc_id = str(doc.get("id"))
        doc_hash = doc.get("hash")
        if doc_id in seen_ids or (doc_hash and doc_hash in seen_hashes):
            continue
        merged.append(doc)
        seen_ids.add(doc_id)
        if doc_hash:
            seen_hashes.add(doc_hash)

    return merged


def _write_documents(
    documents_file: str, documents: List[Dict], merge: bool, backup: bool
) -> int:
    os.makedirs(os.path.dirname(documents_file), exist_ok=True)

    if merge and os.path.exists(documents_file):
        with open(documents_file, "r", encoding="utf-8") as handle:
            existing = json.load(handle)
        documents = _merge_documents(existing, documents)
    elif backup and os.path.exists(documents_file):
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_path = f"{documents_file}.bak.{timestamp}"
        os.replace(documents_file, backup_path)

    with open(documents_file, "w", encoding="utf-8") as handle:
        json.dump(documents, handle, ensure_ascii=False, indent=2)

    return len(documents)


def _post_json(
    url: str, payload: Dict | None = None, params: Dict | None = None
) -> Dict:
    response = requests.post(url, json=payload, params=params, timeout=120)
    response.raise_for_status()
    return response.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest VAT dataset into RAG service"
    )
    parser.add_argument(
        "--vat-dir",
        default=os.getenv(
            "VAT_RAG_DIR", os.path.join(os.getcwd(), "data", "austrian_vat")
        ),
    )
    parser.add_argument(
        "--documents-file",
        default=os.path.join(os.getcwd(), "data", "documents.json"),
    )
    parser.add_argument(
        "--rag-url",
        default=os.getenv("RAG_SERVICE_URL", "http://localhost:8000"),
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge into existing documents.json if present",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup of existing documents.json",
    )
    parser.add_argument(
        "--no-index", action="store_true", help="Skip calling the RAG service"
    )
    parser.add_argument(
        "--background",
        action="store_true",
        help="Run indexing in background via API",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.vat_dir):
        raise SystemExit(f"VAT directory not found: {args.vat_dir}")

    documents = _collect_documents(args.vat_dir)
    if not documents:
        raise SystemExit("No VAT documents found to ingest.")

    doc_count = _write_documents(
        documents_file=args.documents_file,
        documents=documents,
        merge=args.merge,
        backup=not args.no_backup,
    )

    result = {
        "documents_written": doc_count,
        "documents_file": args.documents_file,
        "rag_url": args.rag_url,
        "initialized": None,
    }

    if not args.no_index:
        init_url = f"{args.rag_url.rstrip('/')}/initialize"
        result["initialized"] = _post_json(
            init_url,
            params={
                "force": "false",
                "background": str(args.background).lower(),
            },
        )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
