"""e2e_reingest_verify.py

End-to-end verification script that:
  - Fetches a Paperless original PDF for a given doc_id
  - Posts it to Visual RAG sidecar `/index/pdf`
  - Triggers Text RAG indexing `/indexing/start` (force)
  - Polls Qdrant for visual_pages and document_embeddings points filtered by doc_id
  - Queries Postgres `visual_overlays` for that doc_id
  - Saves JSON/text artifacts to an output directory for audit

Usage:
  python scripts/e2e_reingest_verify.py --doc-id 74 --output-dir artifacts/e2e-2026-01-25 --timeout 60

Env vars expected (defaults provided where reasonable):
  PAPERLESS_API_URL, PAPERLESS_API_TOKEN, VISUAL_RAG_URL, TEXT_RAG_URL, QDRANT_URL
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

"""

import os
import sys
import time
import json
import base64
import argparse
from datetime import datetime

import requests


def _get_env(key: str, default=None):
    return os.environ.get(key) or default


def _save(path, data, mode='w'):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode, encoding='utf-8') as fh:
        if 'b' in mode:
            fh.write(data)
        else:
            if isinstance(data, (dict, list)):
                json.dump(data, fh, indent=2)
            else:
                fh.write(str(data))


def fetch_document_metadata(api_url, token, doc_id):
    headers = {'Authorization': f'Token {token}'} if token else {}
    r = requests.get(f"{api_url.rstrip('/')}/documents/{doc_id}/", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()


def download_pdf(api_url, token, doc_id):
    headers = {'Authorization': f'Token {token}'} if token else {}
    r = requests.get(f"{api_url.rstrip('/')}/documents/{doc_id}/download/", headers=headers, timeout=30)
    r.raise_for_status()
    return r.content


def post_visual_index(visual_url, doc_id, pdf_b64):
    payload = {'doc_id': doc_id, 'pdf_data': pdf_b64}
    r = requests.post(f"{visual_url.rstrip('/')}/index/pdf", json=payload, timeout=60)
    try:
        r.raise_for_status()
    except Exception:
        return {'status_code': r.status_code, 'text': r.text}
    return r.json()


def trigger_text_index(text_rag_url):
    r = requests.post(f"{text_rag_url.rstrip('/')}/indexing/start", json={'force': True, 'background': False}, timeout=30)
    try:
        r.raise_for_status()
    except Exception:
        return {'status_code': r.status_code, 'text': r.text}
    return r.json()


def poll_qdrant_for_doc(qdrant_url, collection, doc_id, timeout=60, interval=2):
    url = f"{qdrant_url.rstrip('/')}/collections/{collection}/points/scroll"
    deadline = time.time() + timeout
    while time.time() < deadline:
        payload = {"filter": {"must": [{"key": "doc_id", "match": {"value": int(doc_id)}}]}, "limit": 10}
        try:
            r = requests.post(url, json=payload, timeout=10)
            if r.status_code == 200:
                data = r.json()
                points = data.get('points') or data.get('result') or []
                if points:
                    return {'ok': True, 'points': points}
            else:
                # treat like not ready yet
                pass
        except Exception as e:
            # ignore and retry
            last_err = str(e)
        time.sleep(interval)
    return {'ok': False, 'error': 'timeout waiting for points', 'last_error': locals().get('last_err', None)}


def query_postgres_overlays(host, port, db, user, password, doc_id):
    try:
        import psycopg2
        conn = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=password, connect_timeout=10)
        cur = conn.cursor()
        cur.execute('SELECT id, doc_id, page_number, overlay_data, vector_id FROM visual_overlays WHERE doc_id = %s', (doc_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        results = []
        for r in rows:
            results.append({'id': r[0], 'doc_id': r[1], 'page_number': r[2], 'overlay_data': r[3], 'vector_id': str(r[4]) if r[4] else None})
        return {'ok': True, 'rows': results}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--doc-id', '-d', required=True, type=int)
    p.add_argument('--output-dir', '-o', default=None)
    p.add_argument('--timeout', '-t', default=60, type=int)

    args = p.parse_args()
    doc_id = args.doc_id
    timeout = args.timeout

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    output_dir = args.output_dir or os.path.join('artifacts', f'e2e-{ts}')
    os.makedirs(output_dir, exist_ok=True)

    PAPERLESS_API_URL = _get_env('PAPERLESS_API_URL', 'http://localhost:8000/api')
    PAPERLESS_API_TOKEN = _get_env('PAPERLESS_API_TOKEN')
    VISUAL_RAG_URL = _get_env('VISUAL_RAG_URL', 'http://127.0.0.1:8001')
    TEXT_RAG_URL = _get_env('TEXT_RAG_URL', 'http://127.0.0.1:8004')
    QDRANT_URL = _get_env('QDRANT_URL', 'http://127.0.0.1:6333')

    POSTGRES_HOST = _get_env('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = int(_get_env('POSTGRES_PORT', '5432'))
    POSTGRES_DB = _get_env('POSTGRES_DB', 'paperless')
    POSTGRES_USER = _get_env('POSTGRES_USER', 'postgres')
    POSTGRES_PASSWORD = _get_env('POSTGRES_PASSWORD', '')

    result = {'doc_id': doc_id, 'steps': {}, 'timestamp': ts}

    # 1) metadata
    try:
        meta = fetch_document_metadata(PAPERLESS_API_URL, PAPERLESS_API_TOKEN, doc_id)
        result['steps']['metadata'] = {'ok': True, 'meta': meta}
        _save(os.path.join(output_dir, 'metadata.json'), meta)
    except Exception as exc:
        result['steps']['metadata'] = {'ok': False, 'error': str(exc)}
        _save(os.path.join(output_dir, 'metadata_error.txt'), str(exc))
        print('Failed to fetch metadata:', exc)
        print('Aborting.')
        _save(os.path.join(output_dir, 'report.json'), result)
        sys.exit(2)

    # 2) download PDF
    try:
        pdf = download_pdf(PAPERLESS_API_URL, PAPERLESS_API_TOKEN, doc_id)
        result['steps']['download'] = {'ok': True, 'size': len(pdf)}
        _save(os.path.join(output_dir, 'document.pdf'), pdf, mode='wb')
        pdf_b64 = base64.b64encode(pdf).decode('utf-8')
        _save(os.path.join(output_dir, 'document_base64.txt'), pdf_b64)
    except Exception as exc:
        result['steps']['download'] = {'ok': False, 'error': str(exc)}
        _save(os.path.join(output_dir, 'download_error.txt'), str(exc))
        print('Failed to download PDF:', exc)
        _save(os.path.join(output_dir, 'report.json'), result)
        sys.exit(3)

    # 3) post to visual rag
    try:
        vis_resp = post_visual_index(VISUAL_RAG_URL, doc_id, pdf_b64)
        result['steps']['visual_index'] = {'ok': True, 'response': vis_resp}
        _save(os.path.join(output_dir, 'visual_index_response.json'), vis_resp)
    except Exception as exc:
        result['steps']['visual_index'] = {'ok': False, 'error': str(exc)}
        _save(os.path.join(output_dir, 'visual_index_error.txt'), str(exc))

    # 4) trigger text rag indexing
    try:
        text_resp = trigger_text_index(TEXT_RAG_URL)
        result['steps']['text_index_trigger'] = {'ok': True, 'response': text_resp}
        _save(os.path.join(output_dir, 'text_index_trigger.json'), text_resp)
    except Exception as exc:
        result['steps']['text_index_trigger'] = {'ok': False, 'error': str(exc)}
        _save(os.path.join(output_dir, 'text_index_error.txt'), str(exc))

    # 5) poll Qdrant for visual_pages and document_embeddings
    visual_poll = poll_qdrant_for_doc(QDRANT_URL, 'visual_pages', doc_id, timeout=timeout)
    doc_poll = poll_qdrant_for_doc(QDRANT_URL, 'document_embeddings', doc_id, timeout=timeout)
    result['steps']['qdrant_visual_pages'] = visual_poll
    result['steps']['qdrant_document_embeddings'] = doc_poll
    _save(os.path.join(output_dir, 'qdrant_visual_pages.json'), visual_poll)
    _save(os.path.join(output_dir, 'qdrant_document_embeddings.json'), doc_poll)

    # 6) query postgres overlays
    pg_res = query_postgres_overlays(POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, doc_id)
    result['steps']['postgres_overlays'] = pg_res
    _save(os.path.join(output_dir, 'postgres_overlays.json'), pg_res)

    # Finalize
    _save(os.path.join(output_dir, 'report.json'), result)

    print('E2E run complete. Artifacts saved to', output_dir)
    if (visual_poll.get('ok') and doc_poll.get('ok')):
        print('Qdrant points found for visual and text collections.')
    else:
        print('Qdrant points missing for one or both collections. See artifacts for details.')

    if not pg_res.get('ok'):
        print('Postgres query failed or returned no overlays. See artifacts for details.')

    # exit code: 0 if both Qdrant polls ok, otherwise 2
    if visual_poll.get('ok') and doc_poll.get('ok'):
        sys.exit(0)
    else:
        sys.exit(2)


if __name__ == '__main__':
    main()
