#!/usr/bin/env python3
"""Ingest the LLM marker taxonomy + OAI regex bundle into the Prosodeus engine.

Reads seed fixtures:
  - scripts/fixtures/llm-markers/llm_marker_indicators.json
  - scripts/fixtures/llm-markers/regex_pattern_families.slim.json
  - scripts/fixtures/llm-markers/regex_mechanisms.slim.json

Writes generated engine artifacts:
  - packages/core/src/taxonomy/llm-marker-patterns.ts
  - packages/core/src/taxonomy/llm-marker-matchers.ts
  - packages/core/src/taxonomy/llm-marker-enrichment.json

Writes the human/LLM-readable hit lists (one per category, plus index.json):
  - hitlists/<category>.json

The source data was exported with fixed-width fields (phrase 50 chars, replacement 60,
genres 40), so cut-off text is detected and repaired or dropped here instead of being
carried into the engine.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
SEED_DIR = ROOT / "scripts/fixtures/llm-markers"
MANUAL_PATH = SEED_DIR / "llm_marker_indicators.json"
OAI_FAMILIES_PATH = SEED_DIR / "regex_pattern_families.slim.json"
OAI_MECHANISMS_PATH = SEED_DIR / "regex_mechanisms.slim.json"
OUT_DIR = ROOT / "packages/core/src/taxonomy"
HITLIST_DIR = ROOT / "hitlists"

# Fixed-width caps in the source export (a value of exactly this length was cut off).
PHRASE_CAP = 50
REPLACEMENT_CAP = 60
GENRES_CAP = 40

CATEGORY_LEVELS = {
    "paragraph_template": "paragraph",
}

SENTENCE_SUBCATEGORIES = {
    "contrastive_negation", "triadic_list", "balanced_formula", "compare_contrast_frame",
    "title_template", "listicle_frame", "engagement_bait", "search_optimizer",
    "content_farm_formula", "uplift_formula",
}

CATEGORY_MAP = {
    "Synthetic significance markers": "Synthetic Significance Markers",
    "LLM transition grease": "LLM Transition Grease",
    "Symmetrical sentence templates": "Symmetrical Sentence Templates",
    "Artificial enthusiasm and hype": "Synthetic Significance Markers",
    "Boilerplate disclaimers and safety padding": "Boilerplate/Conclusions/Person",
    "Corporate gloss and strategy vapor": "Corporate Gloss & Strategy Vap",
    "False nuance and complexity theater": "False Nuance & Complexity Thea",
    "Academic polish markers": "Academic Polish Markers",
    "Persona-flattening phrases": "Boilerplate/Conclusions/Person",
    "Empty conclusion rituals": "Boilerplate/Conclusions/Person",
    "Generic framing fog": "Generic Framing Fog",
    "Overbalanced compare/contrast patterns": "Symmetrical Sentence Templates",
    "SEO slop fragments": "SEO Slop Fragments",
    "Motivational uplift residue": "Motivational Uplift Residue",
    "Model-specific or platform-specific candidate markers": "Model-Specific Markers",
}


# Dataset category (itself cut to 30 chars in the export) -> hit list slug and display title.
CATEGORY_SLUGS = {
    "Synthetic Significance Markers": ("synthetic-significance-markers", "Synthetic significance markers"),
    "Generic Framing Fog": ("generic-framing-fog", "Generic framing fog"),
    "LLM Transition Grease": ("llm-transition-grease", "LLM transition grease"),
    "False Nuance & Complexity Thea": ("false-nuance-complexity-theater", "False nuance and complexity theater"),
    "Corporate Gloss & Strategy Vap": ("corporate-gloss-strategy-vapor", "Corporate gloss and strategy vapor"),
    "Academic Polish Markers": ("academic-polish-markers", "Academic polish markers"),
    "Motivational Uplift Residue": ("motivational-uplift-residue", "Motivational uplift residue"),
    "SEO Slop Fragments": ("seo-slop-fragments", "SEO slop and content-farm fragments"),
    "Symmetrical Sentence Templates": ("symmetrical-sentence-templates", "Symmetrical sentence templates"),
    "Boilerplate/Conclusions/Person": ("boilerplate-conclusions-persona", "Boilerplate, empty conclusions and persona flattening"),
    "Hedging/Sycophancy/Voice Flatt": ("hedging-sycophancy-voice-flattening", "Hedging, sycophancy and voice flattening"),
    "Model-Specific Markers": ("model-specific-markers", "Model-family specific markers"),
}


def normalize_text(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip()
    # Replace curly quotes with straight quotes
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    # Strip surrounding straight quotes often used in the manual
    s = re.sub(r'^"+', '', s)
    s = re.sub(r'"+$', '', s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s)
    return s


def infer_level(subcategory: str) -> str:
    if subcategory in CATEGORY_LEVELS:
        return CATEGORY_LEVELS[subcategory]
    if subcategory in SENTENCE_SUBCATEGORIES:
        return "sentence"
    return "lexical"


def signal_to_weight(signal: str) -> float:
    s = signal.lower()
    if "strong" in s:
        return 1.0
    if "moderate" in s:
        return 0.7
    return 0.4


def fp_to_amplification(fp: str) -> str:
    s = fp.lower()
    if "high" in s:
        return "high"
    if "medium" in s:
        return "med"
    return "low"


def strip_quotes(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace('"', "")).strip()


def clean_phrase(raw: str) -> dict:
    """Split a manual phrase into usable alternatives, repairing source-export damage.

    Returns {"alternatives": [...], "matchable": [...], "truncated": bool, "template": bool}.
    - Quotes are removed per alternative (not only around the whole string), which fixes
      stray `"` characters left by splitting `"a" / "b"`.
    - Parenthetical annotations are not part of the phrase and are dropped.
    - A phrase cut at the 50-char cap loses its (partial) last alternative.
    - Alternatives with unbalanced brackets were cut mid-token and are dropped.
    - Alternatives with standalone X/Y/Z placeholders are sentence templates: kept for
      display but not matchable as literal text.
    `truncated` means nothing usable survived; `template` means nothing matchable did.
    """
    text = raw.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    capped = len(raw) >= PHRASE_CAP
    text = re.sub(r"\s*\([^)]*(\)|$)", "", text)
    alts = [strip_quotes(a) for a in text.split(" / ")]
    alts = [a for a in alts if a]
    if capped and len(alts) > 1:
        alts = alts[:-1]
    cut_single = capped and len(alts) <= 1 and text.count('"') % 2 == 1
    good = [a for a in alts if a.count("[") == a.count("]")]
    placeholder = re.compile(r"\b[XYZ]\b")
    matchable = [a for a in good if not placeholder.search(a)]
    label_prefixed = bool(re.match(r"^[A-Z][^:]{3,40}: ", raw))
    if label_prefixed:
        matchable = []
    return {
        "alternatives": good,
        "matchable": matchable,
        "truncated": not good or cut_single,
        "template": not matchable,
    }


def clean_replacement(raw: str) -> tuple[str, bool]:
    """Repair a replacement cut at the 60-char cap.

    Replacements are either quoted lists (`"Beyond that," "Extending this logic," "The sa`)
    or "a / b" alternatives. Keep the complete items and drop the cut-off tail.
    Returns (text, still_truncated).
    """
    text = raw.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()
    if text.startswith('"'):
        items = [i.strip() for i in re.findall(r'"([^"]+)"', text) if i.strip()]
        if items:
            return " / ".join(items), False
        return normalize_text(raw), True
    text = normalize_text(raw)
    if len(raw) < REPLACEMENT_CAP:
        return text, False
    text = re.sub(r"\s*\([^)]*$", "", text)
    if " / " in text:
        return text.rsplit(" / ", 1)[0].strip(), False
    return text.strip(), True


def clean_genres(raw: str) -> str:
    if len(raw) >= GENRES_CAP and ", " in raw:
        raw = raw.rsplit(", ", 1)[0]
    return raw.strip()


def tier_for(signal: str, fp_risk: str) -> str:
    sig, fp = signal.lower(), fp_risk.lower()
    if "weak" in sig or fp in ("high", "unknown"):
        return "watch"
    if "strong" in sig and fp in ("low", "medium"):
        return "strong"
    return "moderate"


def is_dead_regex(source: str) -> bool:
    """True for patterns that can never match real prose: a start anchor after consuming
    text, an end anchor before consuming text, or quote artifacts from the source export."""
    if re.search(r'["“”]', source):
        return True
    i, n, in_class = 0, len(source), False
    while i < n:
        c = source[i]
        if c == "\\":
            i += 2
            continue
        if in_class:
            in_class = c != "]"
        elif c == "[":
            in_class = True
        elif c == "^":
            prev = source[i - 1] if i else ""
            if prev not in ("", "(", "|", ":", "!", "="):
                return True
        elif c == "$":
            nxt = source[i + 1] if i + 1 < n else ""
            if nxt not in ("", ")", "|"):
                return True
        i += 1
    return False


def phrase_to_regex(phrase: str) -> list[tuple[str, str]]:
    """Convert a manual phrase/pattern into JS RegExp sources and flags."""
    cleaned = clean_phrase(phrase)
    flags = "i"

    # Alternatives like "game-changing / game-changer" become separate patterns
    alternatives = cleaned["matchable"]
    results = []

    for alt in alternatives:
        # If it contains placeholder tokens like [Topic], [Number], [X], convert them
        # to bounded wildcards.
        placeholder_re = re.compile(r"\[[^\]]+\]")
        if placeholder_re.search(alt):
            parts = []
            last = 0
            for m in placeholder_re.finditer(alt):
                literal = alt[last:m.start()]
                if literal.strip():
                    parts.append(re.escape(literal.strip()))
                parts.append(r"[^\n\r]{0,40}?")
                last = m.end()
            literal = alt[last:]
            if literal.strip():
                parts.append(re.escape(literal.strip()))
            results.append(("".join(parts), flags))
            continue

        words = alt.split()
        if len(words) == 1:
            source = r"(?<![a-z0-9])" + re.escape(words[0]) + r"(?![a-z0-9])"
            results.append((source, flags))
            continue

        escaped = [re.escape(w) for w in words]
        flexible = r"[\s\u00A0'’-]*".join(escaped)
        source = r"(?<![a-z0-9])" + flexible + r"(?![a-z0-9])"
        results.append((source, flags))

    return results


def normalize_oai_regex(source: str) -> tuple[str, str]:
    """Strip Python (?i) flag from OAI regex and return source + JS flags."""
    if not isinstance(source, str) or not source:
        return ("", "")
    flags = "i"
    if source.startswith("(?i)"):
        source = source[4:]
    return source, flags


def valid_regex(source: str) -> bool:
    if not source:
        return False
    try:
        re.compile(source)
        return True
    except re.error:
        return False


def extract_regexes_from_family(rec: dict) -> list[tuple[str, str]]:
    """Collect every usable regex from an OAI family record."""
    out: list[tuple[str, str]] = []
    for key in ("primary_regex", "family_overcatch_regex", "surface_exact_or_near_exact_regex"):
        rx = rec.get(key)
        if isinstance(rx, str) and valid_regex(rx) and not is_dead_regex(rx):
            out.append(normalize_oai_regex(rx))
    # regex_matchers_json is a JSON-encoded string of a list of matcher objects.
    matchers_raw = rec.get("regex_matchers_json")
    if isinstance(matchers_raw, str) and matchers_raw.strip():
        try:
            matchers = json.loads(matchers_raw)
            for m in matchers:
                rx = m.get("regex") if isinstance(m, dict) else None
                if isinstance(rx, str) and valid_regex(rx) and not is_dead_regex(rx):
                    out.append(normalize_oai_regex(rx))
        except json.JSONDecodeError:
            pass
    return out


def extract_regexes_from_mechanism(rec: dict) -> list[tuple[str, str]]:
    """Collect every usable regex from an OAI mechanism record."""
    out: list[tuple[str, str]] = []
    for key in ("primary_regex", "mechanism_overcatch_regex"):
        rx = rec.get(key)
        if isinstance(rx, str) and valid_regex(rx) and not is_dead_regex(rx):
            out.append(normalize_oai_regex(rx))
    return out


def build_detection_hint(phrases: list[str], max_examples: int = 6) -> str:
    examples = phrases[:max_examples]
    return " — ".join(examples)


def build_rewrite_menu(rows: list[dict]) -> list[dict]:
    instructions = []
    for r in rows:
        repl = r["_replacement"]
        if repl and not r["_replacement_truncated"] and repl not in instructions:
            instructions.append(repl)
        if len(instructions) >= 5:
            break
    if not instructions:
        instructions = ["Replace the generic phrase with a specific claim."]
    return [{"id": i + 1, "instruction": inst} for i, inst in enumerate(instructions[:5])]


def build_pce_directive(subcategory: str, category: str) -> str:
    # Simple templated directive
    human_name = subcategory.replace("_", " ")
    category_name = category.split("/")[0].strip()
    return f"Do NOT use {human_name} ({category_name})"


def build_examples(rows: list[dict], max_n: int = 10) -> list[dict]:
    out = []
    for r in rows:
        if r["_phrase"]["truncated"]:
            continue
        p = r["_display"]
        if p and p not in {ex["text"] for ex in out}:
            explanation = "" if r["_replacement_truncated"] else r["_replacement"]
            out.append({"text": p, "explanation": explanation})
        if len(out) >= max_n:
            break
    return out


def build_substitutions(rows: list[dict], max_n: int = 10) -> list[dict]:
    out = []
    for r in rows:
        if r["_phrase"]["truncated"] or r["_replacement_truncated"]:
            continue
        f, t = r["_display"], r["_replacement"]
        if f and t and f != t:
            out.append({"from": f, "to": t})
        if len(out) >= max_n:
            break
    return out


def genre_to_style(genre: str) -> list[str]:
    # Naive genre string → style genres used by the engine
    g = genre.lower()
    styles = []
    if "academic" in g or "pubmed" in g or "research" in g:
        styles.append("academic")
    if "marketing" in g or "seo" in g or "affiliate" in g or "saas" in g or "b2b" in g:
        styles.append("marketing")
    if "technical" in g or "engineering" in g or "software" in g or "it " in g:
        styles.append("technical")
    if "journalism" in g or "news" in g or "reporting" in g:
        styles.append("journalism")
    if "fiction" in g or "creative" in g or "narrative" in g or "literary" in g:
        styles.append("literary-essay")
    if "code" in g or "documentation" in g:
        styles.append("code")
    return styles


def build_tolerance_overrides(rows: list[dict]) -> dict:
    # If most genres in a subcategory are marketing, be more tolerant there, etc.
    counts = defaultdict(int)
    for r in rows:
        for s in genre_to_style(r["_genres"]):
            counts[s] += 1
    overrides = {}
    if counts:
        total = sum(counts.values())
        for style, n in counts.items():
            ratio = n / total
            if ratio >= 0.5:
                overrides[style] = 1.5
            elif ratio >= 0.3:
                overrides[style] = 1.2
    return overrides


def write_hitlists(manual: list[dict]) -> None:
    """One JSON file per category: phrases with tier, signal, false-positive risk and the
    suggested replacement. Meant for people and for LLM instructions; the engine reads the
    generated .ts files instead."""
    HITLIST_DIR.mkdir(exist_ok=True)
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for row in manual:
        by_cat[row["category"]].append(row)
    tier_order = {"strong": 0, "moderate": 1, "watch": 2}
    index = []
    for category, rows in sorted(by_cat.items(), key=lambda kv: CATEGORY_SLUGS[kv[0]][0]):
        slug, title = CATEGORY_SLUGS[category]
        entries = []
        for r in sorted(rows, key=lambda r: (tier_order[r["_tier"]], r["id"])):
            entry = {
                "id": r["id"],
                "phrase": r["_display"],
                "alternatives": r["_phrase"]["alternatives"],
                "subcategory": r["subcategory"],
                "tier": r["_tier"],
                "signal": r["signal"],
                "fp_risk": r["fp_risk"],
                "evidence": r["evidence"],
                "replacement": r["_replacement"],
                "genres": r["_genres"],
            }
            if r["_phrase"]["template"]:
                entry["template"] = True
            if r["_phrase"]["truncated"]:
                entry["truncated"] = True
            if r["_replacement_truncated"]:
                entry["replacement_truncated"] = True
            entries.append(entry)
        tiers = {t: sum(1 for e in entries if e["tier"] == t) for t in tier_order}
        doc = {
            "category": title,
            "slug": slug,
            "instructions": f"instructions/{slug}.md",
            "tiers": tiers,
            "entries": entries,
        }
        (HITLIST_DIR / f"{slug}.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        index.append({"slug": slug, "category": title, "entries": len(entries), "tiers": tiers})
    (HITLIST_DIR / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(index)} hit lists ({sum(i['entries'] for i in index)} entries).")


def main():
    manual = json.loads(MANUAL_PATH.read_text())
    for row in manual:
        row["_phrase"] = clean_phrase(row["phrase"])
        row["_display"] = " / ".join(row["_phrase"]["alternatives"])
        row["_replacement"], row["_replacement_truncated"] = clean_replacement(row.get("replacement", ""))
        row["_genres"] = clean_genres(row.get("genres", ""))
        row["_tier"] = tier_for(row.get("signal", ""), row.get("fp_risk", ""))
    by_subcat = defaultdict(list)
    for row in manual:
        by_subcat[row["subcategory"]].append(row)

    oai_families = json.loads(OAI_FAMILIES_PATH.read_text())
    oai_mechanisms = json.loads(OAI_MECHANISMS_PATH.read_text())

    # Group OAI regexes and enrichment by manual top-level category.
    oai_regexes_by_cat: dict[str, list[tuple[str, str]]] = defaultdict(list)
    oai_examples_by_cat: dict[str, list[dict]] = defaultdict(list)
    oai_substitutions_by_cat: dict[str, list[dict]] = defaultdict(list)
    oai_false_positives_by_cat: dict[str, list[dict]] = defaultdict(list)
    oai_detection_notes_by_cat: dict[str, list[str]] = defaultdict(list)

    for rec in oai_families:
        manual_cat = CATEGORY_MAP.get(rec.get("category", ""))
        if not manual_cat:
            continue
        oai_regexes_by_cat[manual_cat].extend(extract_regexes_from_family(rec))

        weak = normalize_text(rec.get("example_weak_sentence_family", ""))
        revised = normalize_text(rec.get("revised_example_sentence_family", ""))
        if weak:
            oai_examples_by_cat[manual_cat].append({"text": weak, "explanation": revised})
        if weak and revised and weak != revised:
            oai_substitutions_by_cat[manual_cat].append({"from": weak, "to": revised})

        notes = normalize_text(rec.get("notes_on_when_still_acceptable", ""))
        if weak and notes:
            oai_false_positives_by_cat[manual_cat].append({"text": weak, "explanation": notes})

        warning = normalize_text(rec.get("do_not_accuse_note", ""))
        if warning:
            oai_detection_notes_by_cat[manual_cat].append(warning)

    for rec in oai_mechanisms:
        manual_cat = CATEGORY_MAP.get(rec.get("category", ""))
        if not manual_cat:
            continue
        oai_regexes_by_cat[manual_cat].extend(extract_regexes_from_mechanism(rec))

        warning = normalize_text(rec.get("forensic_warning", ""))
        if warning:
            oai_detection_notes_by_cat[manual_cat].append(warning)

    patterns = []
    matchers_map = {}

    for idx, (subcat, rows) in enumerate(sorted(by_subcat.items()), start=1):
        category = rows[0]["category"]
        level = infer_level(subcat)
        taxonomy_id = f"AIFM-{idx:03d}"
        name = subcat.replace("_", " ").title()

        avg_weight = sum(signal_to_weight(r.get("signal", "")) for r in rows) / len(rows)
        # Determine self amplification by majority fp risk
        fp_counts = defaultdict(int)
        for r in rows:
            fp_counts[fp_to_amplification(r.get("fp_risk", ""))] += 1
        self_amp = max(fp_counts, key=fp_counts.get) if fp_counts else "med"

        phrases = [r["_display"] for r in rows if r["_display"] and not r["_phrase"]["truncated"]]
        detection_hint = build_detection_hint(phrases)
        rewrite_menu = build_rewrite_menu(rows)
        pce_directive = build_pce_directive(subcat, category)
        examples = build_examples(rows)
        substitutions = build_substitutions(rows)
        tolerance_overrides = build_tolerance_overrides(rows)

        # Merge OAI enrichment into this subcategory pattern.
        examples.extend(oai_examples_by_cat.get(category, []))
        substitutions.extend(oai_substitutions_by_cat.get(category, []))
        false_positives = oai_false_positives_by_cat.get(category, [])
        detection_notes = " ".join(oai_detection_notes_by_cat.get(category, []))

        pattern: dict = {
            "id": subcat,
            "taxonomy_id": taxonomy_id,
            "name": name,
            "level": level,
            "heat_weight": round(avg_weight, 2),
            "self_amplification": self_amp,
            "detection_hint": detection_hint,
            "rewrite_menu": rewrite_menu,
            "pce_directive": pce_directive,
            "tolerance_overrides": tolerance_overrides,
            "description": f"{name} from the LLM marker taxonomy ({category}).",
            "examples": examples,
            "substitutions": substitutions,
            "tags": [category.lower().replace(" ", "_").replace("/", "_"), level],
            "severity": "medium",
        }
        if false_positives:
            pattern["false_positives"] = false_positives
        if detection_notes:
            pattern["detection_notes"] = detection_notes
        patterns.append(pattern)

        # Build matchers as (source, flags) tuples
        regexes: list[tuple[str, str]] = []
        seen = set()
        for r in rows:
            for parsed in phrase_to_regex(r["phrase"]):
                key = (parsed[0], parsed[1])
                if key not in seen:
                    regexes.append(parsed)
                    seen.add(key)
        # Add all OAI regexes for this top-level category
        for parsed in oai_regexes_by_cat.get(category, []):
            key = (parsed[0], parsed[1])
            if key not in seen:
                regexes.append(parsed)
                seen.add(key)
        matchers_map[subcat] = regexes

    # Write llm-marker-patterns.ts
    ts_lines = [
        '/**',
        ' * LLM marker taxonomy patterns.',
        ' * Generated by scripts/ingest-llm-markers.py — do not hand-edit.',
        ' */',
        '',
        'import type { PatternEntry } from "./pattern-registry.ts";',
        '',
        'export const LLM_MARKER_PATTERNS: PatternEntry[] = ',
        json.dumps(patterns, indent=2) + ";",
        '',
    ]
    (OUT_DIR / "llm-marker-patterns.ts").write_text("\n".join(ts_lines))

    # Write llm-marker-matchers.ts
    matcher_ts = [
        '/**',
        ' * LLM marker taxonomy regex matchers (recall layer).',
        ' * Generated by scripts/ingest-llm-markers.py — do not hand-edit.',
        ' */',
        '',
        'export const LLM_MARKER_MATCHERS: Record<string, RegExp[]> = {'
    ]
    for subcat, regexes in matchers_map.items():
        matcher_ts.append(f'  "{subcat}": [')
        for source, flags in regexes:
            # Use new RegExp string constructor to avoid slash escaping issues.
            source_json = json.dumps(source)
            matcher_ts.append(f'    new RegExp({source_json}, {json.dumps(flags)}),')
        matcher_ts.append("  ],")
    matcher_ts.append("};")
    (OUT_DIR / "llm-marker-matchers.ts").write_text("\n".join(matcher_ts))

    # Write enrichment JSON (subset fields for runtime merge)
    enrichment = {
        subcat: {
            "examples": p["examples"],
            "substitutions": p["substitutions"],
            "false_positives": p.get("false_positives", []),
            "detection_notes": p.get("detection_notes", f"Generated from LLM marker taxonomy {p['taxonomy_id']}."),
        }
        for subcat, p in zip(matchers_map.keys(), patterns)
    }
    (OUT_DIR / "llm-marker-enrichment.json").write_text(json.dumps(enrichment, indent=2))

    write_hitlists(manual)

    print(f"Wrote {len(patterns)} patterns.")
    print(f"Wrote {sum(len(v) for v in matchers_map.values())} regexes.")

    # Format generated files with Biome so they stay repo-clean.
    import subprocess

    files_to_format = [
        str(OUT_DIR / "llm-marker-patterns.ts"),
        str(OUT_DIR / "llm-marker-matchers.ts"),
        str(OUT_DIR / "llm-marker-enrichment.json"),
    ]
    try:
        subprocess.run(["npx", "biome", "check", "--write"] + files_to_format, check=True)
    except Exception as e:
        print(f"Biome formatting failed (non-fatal): {e}")


if __name__ == "__main__":
    main()
