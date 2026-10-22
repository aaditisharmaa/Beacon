SURVIVAL_HOURS = 48


def choose_plan_type(hours_left):
    """48 ghante se kam bache (ya deadline nikal gayi) toh survival, warna full."""
    return "survival" if hours_left < SURVIVAL_HOURS else "full"