from __future__ import annotations

import re
import unicodedata

TURKISH_ASCII_TRANSLATION = str.maketrans(
    {
        "\u00e7": "c",
        "\u00c7": "c",
        "\u011f": "g",
        "\u011e": "g",
        "\u0131": "i",
        "\u0130": "i",
        "\u00f6": "o",
        "\u00d6": "o",
        "\u015f": "s",
        "\u015e": "s",
        "\u00fc": "u",
        "\u00dc": "u",
    }
)

# Raw production/model product names stay untouched in the database. This map is only
# used while resolving the matching product name in analytics.consumption_history.
PRODUCT_TO_CONSUMPTION_ALIASES: dict[str, tuple[str, ...]] = {
    "M\u0131s\u0131r": ("M\u0131s\u0131r Durum",),
    "Domates (Sal\u00e7al\u0131k)": ("Domates",),
    "Domates (Sofral\u0131k)": ("Domates",),
    "Elma (Starking)": ("Elma",),
    "Elma (Golden)": ("Elma",),
    "Elma (Amasya)": ("Elma",),
    "Elma (Granny Smith)": ("Elma",),
    "Di\u011fer Elmalar": ("Elma",),
    "Portakal (Washington)": ("Portakal",),
    "Portakal (Yafa)": ("Portakal",),
    "Di\u011fer Portakallar": ("Portakal",),
    "Mandalina (Satsuma)": ("Mandalina",),
    "Mandalina (King)": ("Mandalina",),
    "Mandalina (Klemantin)": ("Mandalina",),
    "Mandalina (Di\u011fer)": ("Mandalina",),
    "Limon Ve Misket Limonu": ("Limon",),
    "Greyfurt (Alt\u0131ntop)": ("Greyfurt",),
    "Sofral\u0131k \u00dcz\u00fcm, \u00c7ekirdekli": ("\u00dcz\u00fcm",),
    "Sofral\u0131k \u00dcz\u00fcm, \u00c7ekirdeksiz": ("\u00dcz\u00fcm",),
    "Kurutmal\u0131k \u00dcz\u00fcm, \u00c7ekirdekli": ("\u00dcz\u00fcm",),
    "Kurutmal\u0131k \u00dcz\u00fcm, \u00c7ekirdeksiz": ("\u00dcz\u00fcm",),
    "\u015earapl\u0131k \u00dcz\u00fcmler": ("\u00dcz\u00fcm",),
    "Durum Bu\u011fday\u0131": ("Bu\u011fday Durum",),
    "Arpa (Di\u011fer)": ("Arpa",),
    "Arpa (Biral\u0131k)": ("Arpa",),
    "Ay\u00e7i\u00e7e\u011fi Tohumu (Ya\u011fl\u0131k)": ("Ay\u00e7i\u00e7e\u011fi",),
    "Ay\u00e7i\u00e7e\u011fi Tohumu (\u00c7erezlik)": ("Ay\u00e7i\u00e7e\u011fi",),
    "Pamuk \u00c7ekirde\u011fi (\u00c7i\u011fit)": ("Pamuk Tohumu \u00c7i\u011fit ", "Pamuk Tohumu \u00c7i\u011fit"),
    "Soya Fasulyesi": ("Soya Fas\u00fclyesi Kuru",),
    "Fasulye, Taze": ("Fasulye Taze",),
    "Fasulye, Kuru": ("Kuru Fasulye",),
    "Bakla, Taze": ("Bakla Taze",),
    "Bezelye, Taze": ("Bezelye Taze",),
    "Kabak (Sak\u0131z)": ("Kabak Sak\u0131z",),
    "Patates (Tatl\u0131 Patates Hari\u00e7)": ("Patates",),
    "So\u011fan (Kuru)": ("So\u011fan Kuru",),
    "So\u011fan (Taze)": ("So\u011fan Taze",),
    "Sar\u0131msak (Kuru)": ("Sar\u0131msak Kuru",),
    "H\u0131yar (Sofral\u0131k)": ("H\u0131yar",),
    "H\u0131yar (Tur\u015fuluk)": ("H\u0131yar",),
    "Biber (Dolmal\u0131k)": ("Biber",),
    "Biber (Sal\u00e7al\u0131k, Kapya)": ("Biber",),
    "Biber (Sivri)": ("Biber",),
    "Biber (\u00c7arliston)": ("Biber",),
    "Marul (G\u00f6bekli)": ("Marul",),
    "Marul (K\u0131v\u0131rc\u0131k)": ("Marul",),
    "Marul (\u0130ceberg)": ("Marul",),
    "Lahana (Beyaz)": ("Lahana",),
    "Lahana (K\u0131rm\u0131z\u0131)": ("Lahana",),
    "Lahana (Kara Yaprak)": ("Lahana",),
    "Lahana (Br\u00fcksel)": ("Lahana",),
    "Nohut, Kuru": ("Nohut",),
    "\u0130ncir (Ya\u015f)": ("\u0130ncir",),
    "\u00c7ay Yapraklar\u0131": ("\u00c7ay",),
    "Muz, Plantain Ve Benzerleri": ("Muz",),
    "Turp (Bay\u0131r)": ("Turp",),
    "Turp (Beyaz)": ("Turp",),
    "Turp (K\u0131rm\u0131z\u0131)": ("Turp",),
}


def normalize_product_key(value: str | None) -> str:
    normalized = " ".join(str(value or "").strip().split())
    normalized = normalized.translate(TURKISH_ASCII_TRANSLATION).lower()
    normalized = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


_NORMALIZED_ALIAS_MAP = {
    normalize_product_key(product_name): aliases
    for product_name, aliases in PRODUCT_TO_CONSUMPTION_ALIASES.items()
}


def get_consumption_mapping_candidates(product_name: str | None) -> list[str]:
    aliases = _NORMALIZED_ALIAS_MAP.get(normalize_product_key(product_name), ())
    return list(aliases)
