import re
from typing import Tuple


def sort_entgeltgruppe_key(val: str) -> Tuple[int, str]:
    """
    Natural sort key for Entgeltgruppe values.

    Examples:
        E 1, E 2, E 2Ü, E 4a, E 4b, E 10 ...
    - Sorts first by numeric part
    - Then by optional letter/umlaut suffix
    """
    if val is None:
        return (999, "")
    val = val.strip().replace("\xa0", " ")
    match = re.match(r"^E\s*(\d+)(\D*)$", val)
    if match:
        number = int(match.group(1))
        suffix = match.group(2).strip() or ""
        return (number, suffix)
    return (999, val)
