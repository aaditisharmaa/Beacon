from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

from .priority import calculate_priority

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)


class PriorityTests(SimpleTestCase):
    def test_overdue_scores_higher_than_far_deadline(self):
        overdue, _ = calculate_priority(NOW - timedelta(hours=1), 3, 0, now=NOW)
        far, _ = calculate_priority(NOW + timedelta(days=30), 3, 0, now=NOW)
        self.assertGreater(overdue, far)

    def test_more_snoozes_raise_score(self):
        calm, _ = calculate_priority(NOW + timedelta(days=3), 3, 0, now=NOW)
        snoozed, _ = calculate_priority(NOW + timedelta(days=3), 3, 4, now=NOW)
        self.assertGreater(snoozed, calm)

    def test_score_stays_between_0_and_10(self):
        worst, _ = calculate_priority(NOW - timedelta(days=5), 5, 50, now=NOW)
        best, _ = calculate_priority(NOW + timedelta(days=100), 1, 0, now=NOW)
        self.assertLessEqual(worst, 10.0)
        self.assertGreaterEqual(best, 0.0)

    def test_reason_is_not_empty(self):
        _, reason = calculate_priority(NOW + timedelta(days=2), 3, 1, now=NOW)
        self.assertTrue(len(reason) > 0)