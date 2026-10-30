from datetime import timedelta

from django.utils import timezone

# complexity ke hisaab se buffer (ghante): jitna mushkil kaam, utna pehle khatam karo
BUFFER_HOURS = {1: 2, 2: 4, 3: 8, 4: 16, 5: 24}


def calculate_internal_deadline(deadline, complexity, now=None):
    """Real deadline se pehle ka apna target. Kabhi past mein nahi jata."""
    now = now or timezone.now()
    time_left = deadline - now
    if time_left <= timedelta(0):
        return deadline

    buffer = timedelta(hours=BUFFER_HOURS.get(complexity, 8))
    target = deadline - buffer

    # itna time hi nahi bacha: bacha hua time ka aadha le lo
    if target <= now:
        return now + time_left / 2
    return target