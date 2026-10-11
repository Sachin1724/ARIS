# Ingest Conflict Report

## Conflict Detection Report

### BLOCKERS (0)

None.

### WARNINGS (0)

None.

### INFO (3)

[INFO] API contract is proposed, not implemented
  Note: All REST/WebSocket routes in api-contract.md are draft contracts. Must be verified against actual UNO Q FastAPI once available.

[INFO] BLE GATT characteristics are proposed
  Note: device_info, pairing_challenge, wifi_config, setup_status, network_result characteristics need firmware-side implementation and UUID agreement.

[INFO] Gas sensor calibration not available
  Note: MQ135 and MG811 values are raw ADC/voltage only. App must never present these as verified ppm until calibration is confirmed.
