"""
Jenny Telemetry Collector
Privacy-first, opt-in event tracking.
All data stored locally as JSON Lines. No PII collected.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("jenny.telemetry")


class TelemetryCollector:
    """Collects anonymous usage events locally.

    Privacy guarantees:
        - Opt-in only (disabled by default)
        - No personally identifiable information
        - All data stored locally
        - No external transmission (in v1)
        - User can delete all data at any time
    """

    def __init__(self, enabled: bool = False, data_dir: str = ".jenny"):
        self.enabled = enabled
        self.data_dir = Path(data_dir) / "telemetry"
        self._buffer: List[Dict[str, Any]] = []
        self._flush_interval = 50  # Flush every 50 events
        self._start_time = time.time()

        if self.enabled:
            self.data_dir.mkdir(parents=True, exist_ok=True)

    def track(self, event: str, properties: Optional[Dict[str, Any]] = None) -> None:
        """Track an event."""
        if not self.enabled:
            return

        entry = {
            "event": event,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "properties": properties or {},
            "session_uptime_s": round(time.time() - self._start_time, 1),
        }

        self._buffer.append(entry)

        if len(self._buffer) >= self._flush_interval:
            self.flush()

    def track_performance(self, operation: str, duration_ms: float) -> None:
        """Track a performance metric."""
        self.track("performance", {
            "operation": operation,
            "duration_ms": round(duration_ms, 2),
        })

    def track_error(self, error_type: str, message: str) -> None:
        """Track an error (no stack traces or PII)."""
        self.track("error", {
            "error_type": error_type,
            "message": message[:200],  # Truncate
        })

    def flush(self) -> None:
        """Write buffered events to disk."""
        if not self.enabled or not self._buffer:
            return

        log_file = self.data_dir / f"events_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"

        try:
            with open(log_file, "a", encoding="utf-8") as f:
                for entry in self._buffer:
                    f.write(json.dumps(entry) + "\n")
            self._buffer.clear()
        except Exception as e:
            logger.error(f"Telemetry flush error: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get telemetry summary."""
        if not self.enabled:
            return {"enabled": False}

        total_events = 0
        log_files = list(self.data_dir.glob("events_*.jsonl"))

        for f in log_files:
            total_events += sum(1 for _ in open(f))

        total_events += len(self._buffer)

        return {
            "enabled": True,
            "total_events": total_events,
            "buffered": len(self._buffer),
            "log_files": len(log_files),
        }

    def clear(self) -> None:
        """Delete all telemetry data."""
        self._buffer.clear()
        if self.data_dir.exists():
            for f in self.data_dir.glob("events_*.jsonl"):
                f.unlink()
        logger.info("Telemetry data cleared")
