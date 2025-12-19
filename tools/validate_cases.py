#!/usr/bin/env python3
"""Valida os casos clínicos do simulador.

Objetivo: evitar que novos casos/DLCs quebrem a engine.
Sem dependências externas.

Uso:
  python tools/validate_cases.py

Exit code:
  0 = OK
  1 = Erros
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "data" / "case_schema_min.json"
CASES_PATH = ROOT / "data" / "cases.js"

def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

def load_cases_from_js() -> list[dict]:
    # cases.js define window.MedSim.Data.CASES = <json>;
    text = CASES_PATH.read_text(encoding="utf-8")
    marker = "window.MedSim.Data.CASES ="
    idx = text.find(marker)
    if idx < 0:
        raise RuntimeError("Não encontrei 'window.MedSim.Data.CASES =' em cases.js")
    json_part = text[idx + len(marker):].strip()
    if not json_part.endswith(";"):
        raise RuntimeError("cases.js não termina com ';' após o JSON.")
    json_part = json_part[:-1].strip()
    return json.loads(json_part)

def is_non_empty_str(v) -> bool:
    return isinstance(v, str) and v.strip() != ""

def validate_case(c: dict, schema: dict) -> list[str]:
    errs: list[str] = []
    for k in schema["required"]:
        if k not in c:
            errs.append(f"Campo obrigatório ausente: {k}")
    if "id" in c and not is_non_empty_str(c["id"]):
        errs.append("id inválido")
    if "difficulty" in c and not (isinstance(c["difficulty"], int) and 1 <= c["difficulty"] <= 5):
        errs.append("difficulty deve ser int 1..5")
    if "triage" in c and not (isinstance(c["triage"], int) and 1 <= c["triage"] <= 4):
        errs.append("triage deve ser int 1..4")
    if "patient" in c and isinstance(c["patient"], dict):
        for pk in schema["patient_required"]:
            if pk not in c["patient"]:
                errs.append(f"patient.{pk} obrigatório")
        if "age" in c["patient"] and not (isinstance(c["patient"]["age"], int) and 0 < c["patient"]["age"] < 120):
            errs.append("patient.age inválido")
        if "sex" in c["patient"] and c["patient"]["sex"] not in ("M", "F", "O"):
            errs.append("patient.sex deve ser M/F/O")
    else:
        errs.append("patient deve ser objeto")
    if "history" in c and not isinstance(c["history"], list):
        errs.append("history deve ser lista")
    if "physicalFindings" in c and not isinstance(c["physicalFindings"], list):
        errs.append("physicalFindings deve ser lista")
    if "vitalsInitial" in c and not isinstance(c["vitalsInitial"], dict):
        errs.append("vitalsInitial deve ser objeto")
    if "correct" in c and isinstance(c["correct"], dict):
        if not is_non_empty_str(c["correct"].get("diagnosis", "")):
            errs.append("correct.diagnosis obrigatório")
        for lk in ("requiredExams", "helpfulExams", "requiredTreatments", "criticalMistakes"):
            if lk in c["correct"] and not isinstance(c["correct"][lk], list):
                errs.append(f"correct.{lk} deve ser lista")
    else:
        errs.append("correct deve ser objeto")
    if "education" in c and isinstance(c["education"], dict):
        if not is_non_empty_str(c["education"].get("summary", "")):
            errs.append("education.summary obrigatório")
        if "keyPoints" in c["education"] and not isinstance(c["education"]["keyPoints"], list):
            errs.append("education.keyPoints deve ser lista")
    else:
        errs.append("education deve ser objeto")
    return errs

def main() -> int:
    schema = load_schema()
    cases = load_cases_from_js()
    all_ids = set()
    failed = 0
    for c in cases:
        cid = c.get("id", "<sem id>")
        if cid in all_ids:
            print(f"[ERRO] id duplicado: {cid}")
            failed += 1
        else:
            all_ids.add(cid)
        errs = validate_case(c, schema)
        if errs:
            failed += 1
            print(f"\n[CASO INVALIDO] {cid}")
            for e in errs:
                print(f"  - {e}")
    if failed == 0:
        print(f"OK: {len(cases)} casos validados.")
        return 0
    print(f"\nFalhas: {failed} (em {len(cases)} casos).")
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
