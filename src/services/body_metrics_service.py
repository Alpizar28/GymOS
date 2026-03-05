"""Body metrics import and query services."""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.body_metrics import BodyMetric

logger = logging.getLogger(__name__)

RANGE_LIMITS = {
    "weight_kg": (20.0, 300.0),
    "body_fat_pct": (2.0, 70.0),
    "muscle_mass_kg": (10.0, 120.0),
}


def parse_measured_at(value: str | date | datetime) -> datetime:
    """Parse date/datetime into naive datetime (UTC if tz provided)."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime.combine(value, time.min)
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            raise ValueError("measured_at is required")
        normalized = raw.replace("Z", "+00:00") if raw.endswith("Z") else raw
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError:
            dt = datetime.combine(date.fromisoformat(raw), time.min)
    else:
        raise ValueError("measured_at must be a string or date")

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_numeric(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if "," in text and "." not in text:
            text = text.replace(",", ".")
        return float(text)
    raise ValueError("Invalid numeric value")


def _validate_range(field: str, value: float | None) -> str | None:
    if value is None:
        return None
    lower, upper = RANGE_LIMITS[field]
    if value < lower or value > upper:
        return f"{field} out of range ({lower}-{upper})"
    return None


def _parse_record(record: dict) -> tuple[dict | None, str | None]:
    if not isinstance(record, dict):
        return None, "Record must be an object"

    try:
        measured_at = parse_measured_at(record.get("measured_at"))
    except Exception as exc:
        return None, f"Invalid measured_at: {exc}"

    try:
        weight_kg = _parse_numeric(record.get("weight_kg"))
        body_fat_pct = _parse_numeric(record.get("body_fat_pct"))
        muscle_mass_kg = _parse_numeric(record.get("muscle_mass_kg"))
    except ValueError as exc:
        return None, str(exc)

    if weight_kg is None and body_fat_pct is None and muscle_mass_kg is None:
        return None, "At least one metric field is required"

    for field, value in (
        ("weight_kg", weight_kg),
        ("body_fat_pct", body_fat_pct),
        ("muscle_mass_kg", muscle_mass_kg),
    ):
        error = _validate_range(field, value)
        if error:
            return None, error

    notes = record.get("notes")
    if notes is not None and not isinstance(notes, str):
        return None, "notes must be a string"

    return {
        "measured_at": measured_at,
        "weight_kg": weight_kg,
        "body_fat_pct": body_fat_pct,
        "muscle_mass_kg": muscle_mass_kg,
        "notes": notes,
        "payload_raw": json.dumps(record, ensure_ascii=True),
    }, None


def parse_csv_records(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    return [row for row in reader]


def parse_date_bound(value: str, *, is_end: bool) -> datetime:
    raw = value.strip()
    if not raw:
        raise ValueError("Date cannot be empty")
    if len(raw) == 10:
        parsed_date = date.fromisoformat(raw)
        return datetime.combine(parsed_date, time.max if is_end else time.min)
    parsed = parse_measured_at(raw)
    if is_end:
        return parsed
    return parsed


async def import_body_metrics(
    session: AsyncSession,
    *,
    source: str,
    records: list[dict],
) -> dict:
    results: list[dict] = []
    inserted = 0
    duplicates = 0
    errors = 0
    seen: set[tuple[str, datetime]] = set()

    for row_index, record in enumerate(records):
        parsed, error = _parse_record(record)
        if error:
            results.append({
                "row_index": row_index,
                "status": "error",
                "error": error,
            })
            errors += 1
            continue

        measured_at = parsed["measured_at"]
        key = (source, measured_at)
        if key in seen:
            results.append({
                "row_index": row_index,
                "status": "duplicate",
                "measured_at": measured_at.isoformat(),
            })
            duplicates += 1
            continue
        seen.add(key)

        existing = await session.execute(
            select(BodyMetric.id).where(
                BodyMetric.source == source,
                BodyMetric.measured_at == measured_at,
            )
        )
        if existing.scalar_one_or_none():
            results.append({
                "row_index": row_index,
                "status": "duplicate",
                "measured_at": measured_at.isoformat(),
            })
            duplicates += 1
            continue

        metric = BodyMetric(source=source, **parsed)
        session.add(metric)
        await session.flush()
        inserted += 1
        results.append({
            "row_index": row_index,
            "status": "inserted",
            "id": metric.id,
            "measured_at": measured_at.isoformat(),
        })

    logger.info(
        "Body metrics import: inserted=%d duplicates=%d errors=%d",
        inserted,
        duplicates,
        errors,
    )
    return {
        "inserted": inserted,
        "duplicates": duplicates,
        "errors": errors,
        "results": results,
    }


async def list_body_metrics(
    session: AsyncSession,
    *,
    source: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[BodyMetric]:
    query = select(BodyMetric)
    if source:
        query = query.where(BodyMetric.source == source)
    if start:
        query = query.where(BodyMetric.measured_at >= start)
    if end:
        query = query.where(BodyMetric.measured_at <= end)
    query = query.order_by(desc(BodyMetric.measured_at), desc(BodyMetric.id))
    result = await session.execute(query)
    return result.scalars().all()


async def get_latest_body_metric(session: AsyncSession) -> BodyMetric | None:
    result = await session.execute(
        select(BodyMetric).order_by(desc(BodyMetric.measured_at), desc(BodyMetric.id)).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_latest_before(
    session: AsyncSession,
    *,
    target: datetime,
) -> BodyMetric | None:
    result = await session.execute(
        select(BodyMetric)
        .where(BodyMetric.measured_at <= target)
        .order_by(desc(BodyMetric.measured_at), desc(BodyMetric.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_body_metrics_summary(session: AsyncSession) -> dict:
    latest = await get_latest_body_metric(session)
    if not latest:
        return {
            "has_data": False,
            "latest": None,
            "delta_7d_weight_kg": None,
            "delta_30d_weight_kg": None,
        }

    latest_weight = latest.weight_kg
    delta_7d = None
    delta_30d = None

    if latest_weight is not None:
        metric_7d = await _get_latest_before(
            session,
            target=latest.measured_at - timedelta(days=7),
        )
        if metric_7d and metric_7d.weight_kg is not None:
            delta_7d = round(latest_weight - metric_7d.weight_kg, 2)

        metric_30d = await _get_latest_before(
            session,
            target=latest.measured_at - timedelta(days=30),
        )
        if metric_30d and metric_30d.weight_kg is not None:
            delta_30d = round(latest_weight - metric_30d.weight_kg, 2)

    return {
        "has_data": True,
        "latest": latest,
        "delta_7d_weight_kg": delta_7d,
        "delta_30d_weight_kg": delta_30d,
    }
