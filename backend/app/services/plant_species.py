import re


def clean_species_name(name: str | None) -> str:
    """
    Normalizes a plant species/common name for comparison so that things like
    "Money Plant" and "Money Plant (Pothos)" or "Mango" and "Mango Tree" are
    recognized as the same species, while unrelated names never collide on a
    loose substring match (the bug that previously caused arbitrary/incorrect
    species — most visibly "Neem Tree" — to be assigned to unrelated plants).
    """
    if not name:
        return ""
    n = name.strip().lower()
    n = re.sub(r"\(.*?\)", "", n)  # drop parenthetical qualifiers, e.g. "(Pothos)"
    n = re.sub(r"\s+", " ", n).strip()
    for suffix in (" tree", " plant"):
        if n.endswith(suffix):
            n = n[: -len(suffix)].strip()
    return n
