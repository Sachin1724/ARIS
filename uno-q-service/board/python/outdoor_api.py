import csv
import json
import math
import threading
import time

from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


class OutdoorAirMonitor:
    """Independent Rourkela outdoor-air data source."""

    LATITUDE = 22.225
    LONGITUDE = 84.8641

    POLL_SECONDS = 30 * 60
    MAX_AGE_SECONDS = 90 * 60

    FIELDS = [
        "pm2_5",
        "pm10",
        "carbon_monoxide",
        "nitrogen_dioxide",
        "sulphur_dioxide",
        "ozone",
        "us_aqi",
    ]

    def __init__(self, directory):
        self.directory = Path(directory)
        self.csv_path = (
            self.directory / "aeris_outdoor_api.csv"
        )

        self.tz = ZoneInfo("Asia/Kolkata")

        self.lock = threading.Lock()
        self.data = None
        self.fetched_at = None
        self.error = None

        self.next_fetch = 0.0
        self.last_print = 0.0
        self.fetching = False

        print("[OUTDOOR API] Rourkela configured")
        print("[OUTDOOR API] Lat:", self.LATITUDE)
        print("[OUTDOOR API] Lon:", self.LONGITUDE)
        print("[OUTDOOR API] Local sensors unchanged")

    def _download(self):
        params = {
            "latitude": self.LATITUDE,
            "longitude": self.LONGITUDE,
            "current": ",".join(self.FIELDS),
            "timezone": "Asia/Kolkata",
            "forecast_days": 1,
        }

        url = (
            "https://air-quality-api.open-meteo.com/"
            "v1/air-quality?" + urlencode(params)
        )

        request = Request(
            url,
            headers={
                "User-Agent": "AERIS-UNOQ/1.0"
            }
        )

        with urlopen(request, timeout=15) as response:
            payload = json.load(response)

        current = payload.get("current", {})
        units = payload.get("current_units", {})

        api_time = current.get("time")

        if not api_time:
            raise ValueError("API timestamp missing")

        values = {}

        for field in self.FIELDS:
            raw = current.get(field)
            if raw is None:
                values[field] = None
                continue

            value = float(raw)

            if not math.isfinite(value):
                values[field] = None
            else:
                values[field] = value

        if all(v is None for v in values.values()):
            raise ValueError("No valid API readings")

        # Use the API's source timestamp.
        sample_time = datetime.fromisoformat(
            api_time
        ).replace(tzinfo=self.tz)

        # Reject implausibly future-dated samples.
        now = datetime.now(self.tz)
        age = (now - sample_time).total_seconds()

        if age < -3600:
            raise ValueError("Future API sample timestamp")

        # Current API values may represent a model
        # time interval, not an instant observation.
        return {
            "time": sample_time.isoformat(),
            "values": values,
            "units": units,
            "source": "Open-Meteo outdoor model",
        }

    def _append_csv(self, record, fetched_at):
        new_file = (
            not self.csv_path.exists()
            or self.csv_path.stat().st_size == 0
        )

        with self.csv_path.open(
            "a", newline="", encoding="utf-8"
        ) as file:
            writer = csv.writer(file)

            if new_file:
                writer.writerow(
                    [
                        "fetched_at",
                        "api_time",
                        "source",
                    ] + self.FIELDS
                )

            writer.writerow(
                [
                    fetched_at.isoformat(),
                    record["time"],
                    record["source"],
                ] + [
                    record["values"].get(field)
                    for field in self.FIELDS
                ]
            )

    def _worker(self):
        try:
            record = self._download()
            fetched_at = datetime.now(self.tz)

            self._append_csv(record, fetched_at)

            with self.lock:
                self.data = record
                self.fetched_at = fetched_at
                self.error = None

            print(
                "[OUTDOOR API] Updated:",
                record["time"]
            )

        except Exception as exc:
            with self.lock:
                self.error = str(exc)

            print(
                "[OUTDOOR API] Fetch failed:",
                exc
            )

        finally:
            with self.lock:
                self.fetching = False

    def snapshot(self):
        with self.lock:
            record = self.data
            fetched_at = self.fetched_at
            error = self.error
            fetching = self.fetching

        if record is None or fetched_at is None:
            return None, error, fetching

        age = (
            datetime.now(self.tz) - fetched_at
        ).total_seconds()

        if age > self.MAX_AGE_SECONDS:
            return None, "Cached API data expired", fetching

        return record, error, fetching

    def tick(self):
        now = time.monotonic()

        # Start API fetch outside the main sensor loop.
        with self.lock:
            start_fetch = (
                not self.fetching
                and now >= self.next_fetch
            )

            if start_fetch:
                self.fetching = True
                self.next_fetch = (
                    now + self.POLL_SECONDS
                )

        if start_fetch:
            threading.Thread(
                target=self._worker,
                daemon=True,
                name="AERIS-OutdoorAPI"
            ).start()

        # Display every 30 seconds, independently
        # of weather-history CSV sampling.
        if now - self.last_print < 30:
            return

        self.last_print = now

        record, error, fetching = self.snapshot()

        print("\n===== AERIS OUTDOOR API =====")

        if record is None:
            if fetching:
                print("Status: FETCHING")
            else:
                print("Status: UNAVAILABLE")

            if error:
                print("Reason:", error)

            print("Physical sensors: UNCHANGED")
            print("============================")
            return

        values = record["values"]
        units = record["units"]

        print("Location: Rourkela")
        print("Source: Open-Meteo outdoor model")
        print("API time:", record["time"])

        for field in self.FIELDS:
            value = values.get(field)

            if value is None:
                result = "N/A"
            else:
                result = (
                    f"{value:.2f} "
                    f"{units.get(field, '')}"
                )

            print(f"{field}: {result}")

        if error:
            print("Last fetch error:", error)
            print("Showing cached API values")

        print("Indoor sensor readings: NOT REPLACED")
        print("AQI classifier: SEPARATE MODEL")
        print("============================")
