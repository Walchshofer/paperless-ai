# Alpha-9 Verification Master Checklist

> **Phase 4 Final Verification - Production Readiness Checklist**
>
> This document outlines the three-tier verification pipeline for the Alpha-9 Native Protocol.

## Overview

The Alpha-9 verification system is organized into three tiers:

| Tier | Name | Trigger | Target Time | Gate Type |
|------|------|---------|-------------|-----------|
| 0 | Fast Audit | Per-commit | < 5 min | Blocking |
| 1 | Integration | Per-PR | < 15 min | Blocking |
| 2 | E2E Acceptance | Per-release | < 30 min | Advisory |

---

## Tier 0: Fast Verification (Per-Commit)

**Workflow:** `.github/workflows/alpha9-fast-audit.yml`
**Script:** `bash scripts/alpha9-verify-all.sh --fast`

### Checklist

- [ ] **Lint Checks**
  - [ ] ESLint passes (no warnings)
  - [ ] Python Flake8 passes (79-char limit)
  - [ ] TypeScript strict mode passes

- [ ] **Contract Validation**
  - [ ] All Zod schemas compile
  - [ ] Island contracts validate
  - [ ] Event schemas registered

- [ ] **Unit Tests**
  - [ ] Unit test suite passes
  - [ ] QdrantAdapter tests pass
  - [ ] Coverage threshold met (80%)

- [ ] **Schema Audit**
  - [ ] No vector columns in Postgres
  - [ ] DB migrations applied

### Reproduction Steps

```bash
# Run Tier-0 verification locally
bash scripts/alpha9-verify-all.sh --fast

# Or run individual checks
npm run lint
npm test
node scripts/check-islands.js
```

---

## Tier 1: Integration Verification (Per-PR)

**Workflow:** `.github/workflows/alpha9-integration.yml`
**Script:** `bash scripts/alpha9-verify-all.sh --integration`

### Checklist

- [ ] **Handshake Tests**
  - [ ] 503 Initializing state handled
  - [ ] Text-RAG fallback triggers correctly
  - [ ] Circuit breaker state transitions work
  - [ ] 5-second timeout respected

- [ ] **Distance Metric Lock**
  - [ ] `visual_pages` uses Dot Product (320D)
  - [ ] `visual_overlays` uses Cosine (320D)
  - [ ] `document_embeddings` uses Cosine (384D)
  - [ ] MaxSim compatibility verified

- [ ] **Payload Mirroring**
  - [ ] Correspondent updates sync to Qdrant (< 2s)
  - [ ] Tag updates sync to Qdrant (< 2s)
  - [ ] Background sync job functional
  - [ ] Sync failure handling works

- [ ] **Telemetry**
  - [ ] `/metrics` endpoint accessible
  - [ ] `maxsim_score_mean` metric exists
  - [ ] `sidecar_vram_usage` metric exists
  - [ ] Request ID propagation works

### Reproduction Steps

```bash
# Run Tier-1 verification locally
bash scripts/alpha9-verify-all.sh --integration

# Verify Qdrant configuration
node scripts/verify-qdrant-alpha9.js

# Run integration tests
npm run test:integration
```

---

## Tier 2: E2E Acceptance (Per-Release)

**Workflow:** `.github/workflows/alpha9-e2e-stress.yml`
**Script:** `bash scripts/alpha9-verify-all.sh --e2e`

### Checklist

- [ ] **Red Pen Flow**
  - [ ] Open document in History view
  - [ ] Draw bounding box with Red Pen
  - [ ] Visual search triggers correctly
  - [ ] MaxSim results render
  - [ ] Results are relevant

- [ ] **RLHF Feedback Loop**
  - [ ] "Confirm Match" button functional
  - [ ] Write to `feedback_events` table
  - [ ] Qdrant payload updates
  - [ ] Feedback persistence verified

- [ ] **VRAM Stress**
  - [ ] Baseline usage ~3.5GB
  - [ ] No OOM errors under load
  - [ ] Memory cleanup after requests
  - [ ] Concurrent requests handled

- [ ] **Performance**
  - [ ] Visual search latency < 2s (p95)
  - [ ] Payload sync latency < 2s
  - [ ] Throughput: 100 req/min sustained

### Reproduction Steps

```bash
# Run Tier-2 verification locally
bash scripts/alpha9-verify-all.sh --e2e

# Run E2E tests
npm run verification:e2e

# Monitor VRAM during testing
bash scripts/vram-monitor.sh 120 2
```

---

## Quick Reference: All Verification Gates

### Critical Gates (Blocking)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Unit Tests | `npm test` | All pass, 80% coverage |
| Contracts | `node scripts/check-islands.js` | All schemas valid |
| Qdrant Config | `node scripts/verify-qdrant-alpha9.js` | All collections correct |
| Integration | `npm run test:integration` | All 71+ tests pass |

### Advisory Gates (Non-Blocking)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| E2E Tests | `npm run verification:e2e` | Core flows pass |
| Performance | `npm run test:performance` | Meets SLA targets |
| VRAM Audit | `bash scripts/vram-monitor.sh` | < 4GB baseline |

---

## Troubleshooting Guide

### Common Issues

#### 1. Qdrant Connection Failed
```
Error: Connection refused to localhost:6333
```
**Solution:** Ensure Qdrant container is running:
```bash
docker-compose up -d qdrant
```

#### 2. Postgres Vector Column Found
```
❌ Found vector columns in Postgres
```
**Solution:** Vectors should be in Qdrant, not Postgres. Run migration:
```bash
node scripts/migrate_visual_rag_colqwen3.js
```

#### 3. Distance Metric Mismatch
```
❌ Invalid config for visual_pages: Expected 320/Dot, got 320/Cosine
```
**Solution:** Recreate collection with correct distance metric:
```bash
node scripts/verify-qdrant-alpha9.js --fix
```

#### 4. 503 Timeout
```
Sidecar returned 503 for > 30 seconds
```
**Solution:** Model may be loading. Check sidecar logs:
```bash
docker logs visual_rag --tail 100
```

#### 5. VRAM Exceeded
```
VRAM usage exceeded: 8192MB > 4096MB threshold
```
**Solution:** Reduce batch size or check for memory leaks. Monitor with:
```bash
bash scripts/vram-monitor.sh 60 1
```

---

## CI/CD Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_URL` | (required) | PostgreSQL connection string |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant vector store URL |
| `SIDECAR_URL` | `http://localhost:8001` | Visual RAG sidecar URL |
| `SKIP_SIDECAR` | `false` | Skip sidecar tests (for CI) |
| `VRAM_BASELINE_GB` | `3.5` | Expected VRAM baseline |

### Secrets Required

- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name
- `POSTGRES_HOST` - Database host

### Running Locally

```bash
# Full verification suite
bash scripts/alpha9-verify-all.sh --all

# Fast checks only (for development)
bash scripts/alpha9-verify-all.sh --fast

# Integration checks (before PR)
bash scripts/alpha9-verify-all.sh --integration

# E2E checks (before release)
bash scripts/alpha9-verify-all.sh --e2e
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-18 | 1.0.0 | Initial Phase 4 verification checklist |

---

## References

- **Epic Brief:** Structured Feature Development Workflow
- **Phase 4 Spec:** 016 Verification Checklist
- **Architecture:** Native Protocol Alpha-9
- **Hardware:** RTX 3090 Ti (Ampere SM86)
