from __future__ import annotations

import json
from pathlib import Path

CELL_STAGES = {
    2: "Kurulum/import ve yol ayarlari",
    3: "Yardimci fonksiyonlar",
    4: "Uretim ve iklim verisini yukleme",
    5: "Leakage-safe tarihsel feature seti",
    6: "Direct horizon veri setleri ve grup projeksiyonlari",
    7: "Feature listesi",
    8: "Model/guardrail fonksiyonlari",
    9: "Walk-forward backtest",
    10: "Backtest metrik ozeti",
    11: "Final horizon modellerini egitme",
    12: "Gelecek satiri uretim fonksiyonlari",
    13: "2025-2027 gelecek tahminlerini uretme",
    14: "Excel ciktilarini models/uretim altina yazma",
}


def main() -> None:
    notebook_path = Path(__file__).with_name("dengeli_xgboost_direct_horizon_guardrailli_pipeline.ipynb")
    repo_root = notebook_path.parents[2]

    namespace = {"display": lambda *args, **kwargs: None}
    notebook = json.loads(notebook_path.read_text(encoding="utf-8"))

    for cell_index in range(2, 15):
        stage = CELL_STAGES.get(cell_index, "Bilinmeyen asama")
        source = "".join(notebook["cells"][cell_index - 1].get("source", []))
        print(f"RUN_CELL {cell_index} START - {stage}", flush=True)
        exec(compile(source, f"{notebook_path.name}:cell_{cell_index}", "exec"), namespace)
        print(f"RUN_CELL {cell_index} DONE - {stage}", flush=True)

    print("URETIM_MODEL_RUN_COMPLETED", flush=True)
    print("Output directory:", repo_root / "models" / "uretim", flush=True)


if __name__ == "__main__":
    main()
