# Synthesis

Ingested 21 documents from `ARIS_Full_App_Specification/`.

## Classification Summary
- **ADR** (1): architecture-decisions.md
- **PRD** (1): product-brief.md
- **SPEC** (10): architecture, functional-requirements, data-model, design-system, api-contract, device-connection, ai-voice-conversation, security-privacy, navigation-and-screen-map, ui-flow, screen-specifications
- **DOC** (9): implementation-roadmap, animation-motion, mascot-guidelines, accessibility, error-empty-loading-states, testing-and-acceptance, release-checklist, README

## Precedence Applied
ADR > SPEC > PRD > DOC (default)

## Key Synthesis Points

### Stack (LOCKED via ADR)
React Native + Expo + TypeScript, Expo Router, gluestack-ui, NativeWind, Poppins/Inter. UNO Q backend with FastAPI/SQLite/LSTM/deterministic rules/optional SLM.

### Architecture (SPEC-level)
App is a thin client. UNO Q is source of truth. BLE for provisioning only, Wi-Fi for runtime. REST + WebSocket split. Local-first, no cloud.

### Implementation Phases (DOC-level, advisory)
9 phases from scaffold to release testing. BLE implementation gated on firmware GATT contract confirmation.

### Unverified Contracts
API routes and BLE GATT characteristics are proposed — not existing implementation. Must align with actual hardware/firmware.

## Cross-Reference Integrity
All 21 documents are internally consistent. No contradictions detected between ADR-locked decisions and SPEC/PRD/DOC content. The architecture-decisions.md ADR and the architecture.md SPEC are aligned on stack, protocol, and authority model.

## Intel Files Written
- `decisions.md` — locked, accepted, and deferred decisions
- `requirements.md` — functional and non-functional requirements with IDs
- `constraints.md` — hardware, stack, network, security, scope constraints
- `context.md` — project context summary
