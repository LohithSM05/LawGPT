"""NLP/reference-data helpers for the case-analysis layer (Module 5 Phase 3).

Curated IPC↔BNS section correspondence data. This is deliberately a SMALL,
source-verified subset of the official BNS↔IPC correspondence table — NOT an
exhaustive statutory table. Rules enforced here, per the phase constraints:

* We never invent a mapping. Only entries present in ``IPC_TO_BNS`` /
  ``BNS_TO_IPC`` are ever emitted as an ``equivalent`` cross-reference.
* A code/section with no curated mapping stays explicitly unknown
  (``equivalent`` is left empty).
* Matching is at the base-section level (e.g. "318(4)" matches the "318"
  entry) — BNS restructured many IPC provisions into sub-sections, so the
  correspondence here is section-level, not a promise of identical
  ingredients or punishment.

Sources (verified during Module 5 Phase 3 development): the BPRD "Correspondence
Table and Comparison Summary of the BNS, 2023 to the IPC, 1860" and multiple
2025-verified IPC→BNS reference tables. This is educational reference data and
should get a native-speaker / legal review pass before any real submission.
"""

# IPC section (base number) -> (BNS section, short label)
IPC_TO_BNS = {
    "34": ("3(5)", "Acts done by several persons in furtherance of common intention"),
    "120B": ("61", "Criminal conspiracy"),
    "124A": ("152", "Sedition (acts endangering sovereignty, unity and integrity of India)"),
    "302": ("103", "Punishment for murder"),
    "304": ("105", "Culpable homicide not amounting to murder"),
    "304A": ("106", "Causing death by negligence"),
    "304B": ("80", "Dowry death"),
    "306": ("108", "Abetment of suicide"),
    "307": ("109", "Attempt to murder"),
    "323": ("115", "Voluntarily causing hurt"),
    "324": ("118", "Voluntarily causing hurt or grievous hurt by dangerous weapons or means"),
    "325": ("117", "Voluntarily causing grievous hurt"),
    "326": ("118", "Voluntarily causing grievous hurt by dangerous weapons or means"),
    "341": ("126", "Wrongful restraint"),
    "354": ("74", "Assault or use of criminal force to a woman to outrage her modesty"),
    "354A": ("75", "Sexual harassment"),
    "354D": ("78", "Stalking"),
    "363": ("137", "Kidnapping"),
    "375": ("63", "Rape (definition)"),
    "376": ("64", "Punishment for rape"),
    "376D": ("70", "Gang rape"),
    "377": ("REMOVED", "Unnatural offences — decriminalised, removed from BNS"),
    "378": ("303(1)", "Theft (definition)"),
    "379": ("303(2)", "Punishment for theft"),
    "380": ("305", "Theft in a dwelling house"),
    "384": ("308", "Extortion"),
    "392": ("309", "Robbery"),
    "395": ("310", "Dacoity"),
    "406": ("316", "Criminal breach of trust"),
    "415": ("318(1)", "Cheating (definition)"),
    "417": ("318(2)", "Punishment for cheating"),
    "419": ("319", "Cheating by personation"),
    "420": ("318(4)", "Cheating and dishonestly inducing delivery of property"),
    "425": ("324", "Mischief"),
    "468": ("336", "Forgery"),
    "499": ("356", "Defamation (definition)"),
    "500": ("356", "Punishment for defamation"),
    "506": ("351", "Criminal intimidation"),
}

# BNS section (base number) -> (IPC section, short label) — reverse direction.
BNS_TO_IPC = {
    "3": ("34", "Acts done by several persons in furtherance of common intention"),
    "61": ("120B", "Criminal conspiracy"),
    "63": ("375", "Rape (definition)"),
    "64": ("376", "Punishment for rape"),
    "70": ("376D", "Gang rape"),
    "74": ("354", "Assault or use of criminal force to a woman to outrage her modesty"),
    "75": ("354A", "Sexual harassment"),
    "78": ("354D", "Stalking"),
    "80": ("304B", "Dowry death"),
    "85": ("498A", "Cruelty by husband or relatives of husband"),
    "103": ("302", "Punishment for murder"),
    "105": ("304", "Culpable homicide not amounting to murder"),
    "106": ("304A", "Causing death by negligence"),
    "108": ("306", "Abetment of suicide"),
    "109": ("307", "Attempt to murder"),
    "115": ("323", "Voluntarily causing hurt"),
    "117": ("325", "Voluntarily causing grievous hurt"),
    "118": ("324", "Voluntarily causing hurt or grievous hurt by dangerous weapons or means"),
    "126": ("341", "Wrongful restraint"),
    "137": ("363", "Kidnapping"),
    "152": ("124A", "Sedition (acts endangering sovereignty, unity and integrity of India)"),
    "303": ("378", "Theft (definition)"),
    "305": ("380", "Theft in a dwelling house"),
    "308": ("384", "Extortion"),
    "309": ("392", "Robbery"),
    "310": ("395", "Dacoity"),
    "316": ("406", "Criminal breach of trust"),
    "318": ("420", "Cheating and dishonestly inducing delivery of property"),
    "319": ("419", "Cheating by personation"),
    "324": ("425", "Mischief"),
    "336": ("468", "Forgery"),
    "351": ("506", "Criminal intimidation"),
    "356": ("499", "Defamation"),
}

_CANONICAL_CODES = ("IPC", "BNS", "BNSS", "BSA", "OTHER")


def _base_number(section: str) -> str | None:
    """Extract the leading integer of a section reference ("318(4)" -> "318")."""
    digits = ""
    for ch in str(section or "").strip():
        if ch.isdigit():
            digits += ch
        elif digits:
            break
    return digits or None


def normalize_law(code: str, section: str, fallback_label: str = "") -> dict:
    """Return the curated cross-reference + label for a law mention.

    Never invents a mapping: if neither direction has an entry for this
    section, ``equivalent`` is "" and the equivalence stays explicitly unknown.
    """
    code = (code or "").strip().upper()
    base = _base_number(section)

    equivalent = ""
    label = (fallback_label or "").strip()

    if base:
        if code == "IPC":
            entry = IPC_TO_BNS.get(base)
            if entry:
                bns_sec, curated_label = entry
                if bns_sec == "REMOVED":
                    equivalent = "Removed from BNS (decriminalised)"
                else:
                    equivalent = f"BNS {bns_sec}"
                label = curated_label
        elif code == "BNS":
            entry = BNS_TO_IPC.get(base)
            if entry:
                ipc_sec, curated_label = entry
                equivalent = f"IPC {ipc_sec}"
                label = curated_label

    return {"equivalent": equivalent, "label": label}