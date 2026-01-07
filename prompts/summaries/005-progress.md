# 005 — Upgrade Visual Sidecar (Progress)

## Status
**Started:** 2026-01-07
**Current Phase:** Investigation & Implementation

## Objectives
1.  Update `SearchRequest` schema in `visual-rag-sidecar/main.py` to support `query_image` (base64).
2.  Implement image search logic in `/search` endpoint using `TomoroAI/tomoro-colqwen3-embed-8b`.
3.  Enforce strict offline mode and model constraints.
4.  Verify functionality with a test script.

## Work Completed
- Initialized progress file.
