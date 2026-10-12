"""
AERIS GP2Y1010AU0F provisional signal analysis.

NOT a validated dust-concentration calibration.
NOT a PM2.5 or PM10 measurement.
"""

import math

REFERENCE_V = 0.237

# Diagnostic thresholds chosen from observed
# separated voltage regimes, not environmental
# air-quality thresholds.
LOW_REGIME_MAX_V = 0.6
HIGH_REGIME_MIN_V = 2.5


def analyze_dust(voltage):
    if voltage is None:
        return {
            "status": "UNAVAILABLE",
            "relative_voltage": None,
            "calibrated": False
        }

    try:
        voltage = float(voltage)
    except (TypeError, ValueError):
        return {
            "status": "INVALID",
            "relative_voltage": None,
            "calibrated": False
        }

    if not math.isfinite(voltage) or voltage < 0:
        return {
            "status": "INVALID",
            "relative_voltage": None,
            "calibrated": False
        }

    if voltage > HIGH_REGIME_MIN_V:
        return {
            "status": "HIGH_REGIME_UNVERIFIED",
            "relative_voltage": None,
            "calibrated": False
        }

    if voltage > LOW_REGIME_MAX_V:
        return {
            "status": "TRANSITION_UNVERIFIED",
            "relative_voltage": None,
            "calibrated": False
        }

    delta = voltage - REFERENCE_V

    return {
        "status": "LOW_REGIME",
        "relative_voltage": round(delta, 4),
        "calibrated": False
    }


if __name__ == "__main__":
    for value in [0.227, 0.248, 0.341, 3.283]:
        print(value, analyze_dust(value))
