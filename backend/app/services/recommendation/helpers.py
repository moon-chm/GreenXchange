import re


def parse_temp_range(value):
    """Parse catalog ranges including negative temperatures and degree symbols."""
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*°?\s*[Cc]?\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)", value or "")
    if not match:
        return None
    low, high = map(float, match.groups())
    return (low, high) if low <= high else None


def normalize_name(value):
    return " ".join(re.sub(r"\([^)]*\)", "", value).casefold().split())


def environment_note(profile):
    if profile.get("simulated") or profile.get("stale"):
        return "Environmental data is estimated or stale. Check local conditions before choosing a plant."
    return "Based on area data (cached for up to an hour); indoor light, soil and seasonal changes are not measured."
