from datetime import datetime, timezone


def procrastination_score(snooze_count):
    """Har snooze pe +2, maximum 10."""
    return min(10.0, snooze_count * 2.0)


def _time_text(hours_left):
    if hours_left <= 0:
        return "Deadline has passed"
    if hours_left < 48:
        return f"Due in {round(hours_left)}h"
    return f"Due in {round(hours_left / 24)} days"


def calculate_priority(deadline, complexity, snooze_count, now=None):
    """Returns (score 0.0-10.0, reason text)."""
    now = now or datetime.now(timezone.utc)
    hours_left = (deadline - now).total_seconds() / 3600

    if hours_left <= 0:
        urgency = 10.0
    else:
        urgency = 10 * (1 - min(hours_left, 168) / 168)

    proc = procrastination_score(snooze_count)
    score = 0.5 * urgency + 0.2 * (complexity * 2) + 0.3 * proc
    score = round(min(10.0, max(0.0, score)), 1)

    reason = (
        f"{_time_text(hours_left)}, complexity {complexity}/5, "
        f"snoozed {snooze_count} time(s)"
    )
    return score, reason