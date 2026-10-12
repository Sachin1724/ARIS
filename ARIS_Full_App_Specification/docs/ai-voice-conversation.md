# AI, Voice and Conversation

The deterministic UNO Q pipeline is authoritative for readings, forecasts and allowed recommendations. The local SLM phrases approved facts but cannot invent values, thresholds or override rules.

Text flow: user question → backend gathers readings/trend/forecast/provider freshness → rules engine supplies reasons → local SLM phrases → app shows answer and evidence.

Planned voice flow: tap mic → permission → local ASR if supported → transcript → same query flow → response text → optional local TTS. Text remains available if audio fails.

Answer style: conversational summary first, expandable “Why I say this”, values with units/timestamps, practical next step and caveats. If forecast isn't ready, say data is being collected. If a sensor is uncalibrated, call it a raw response. If provider data is stale, show its age. No medical diagnosis, absolute safety guarantees or unsupported causal claims.
