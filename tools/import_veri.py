import argparse
import os
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import pandas as pd


DEFAULT_DB_NAME = "tarimpro"
DEFAULT_DB_USER = "postgres"
DEFAULT_PG_BIN = Path(r"C:\Program Files\PostgreSQL\18\bin")
MODEL_NAME = "Dengeli_XGBoost_DirectHorizon"
MODEL_VERSION = "2025_2027"


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


class PostgresImporter:
    def __init__(self, db_name: str, db_user: str, pg_bin: Path):
        self.db_name = db_name
        self.db_user = db_user
        self.psql = pg_bin / "psql.exe"
        self.createdb = pg_bin / "createdb.exe"
        if not self.psql.exists():
            raise FileNotFoundError(f"psql bulunamadi: {self.psql}")

    def run_psql(self, sql: str, database: str | None = None) -> None:
        cmd = [
            str(self.psql),
            "-U",
            self.db_user,
            "-d",
            database or self.db_name,
            "-w",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ]
        subprocess.run(cmd, check=True)

    def run_psql_file(self, sql_file: Path) -> None:
        cmd = [
            str(self.psql),
            "-U",
            self.db_user,
            "-d",
            self.db_name,
            "-w",
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            str(sql_file),
        ]
        subprocess.run(cmd, check=True)

    def ensure_database(self) -> None:
        check_sql = f"SELECT 1 FROM pg_database WHERE datname = '{self.db_name}';"
        cmd = [
            str(self.psql),
            "-U",
            self.db_user,
            "-d",
            "postgres",
            "-w",
            "-tAc",
            check_sql,
        ]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout.strip() == "1":
            return
        subprocess.run(
            [str(self.createdb), "-U", self.db_user, "-w", self.db_name],
            check=True,
        )

    def copy_dataframe(self, dataframe: pd.DataFrame, table_name: str) -> None:
        dataframe = dataframe.where(pd.notnull(dataframe), None)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".csv",
            delete=False,
            newline="",
        ) as temp_file:
            temp_path = Path(temp_file.name)
        try:
            dataframe.to_csv(temp_path, index=False)
            columns = ", ".join(quote_identifier(column) for column in dataframe.columns)
            copy_command = (
                f"\\copy {table_name} ({columns}) "
                f"FROM '{temp_path.as_posix()}' WITH (FORMAT csv, HEADER true, NULL '')"
            )
            self.run_psql(copy_command)
        finally:
            temp_path.unlink(missing_ok=True)


def to_snake(name: str) -> str:
    normalized = str(name).strip()
    manual_map = {
        "\u0131": "i",
        "\u0130": "I",
        "\u015f": "s",
        "\u015e": "S",
        "\u011f": "g",
        "\u011e": "G",
        "\u00fc": "u",
        "\u00dc": "U",
        "\u00f6": "o",
        "\u00d6": "O",
        "\u00e7": "c",
        "\u00c7": "C",
    }
    for source, target in manual_map.items():
        normalized = normalized.replace(source, target)
    normalized = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii").lower()
    replacements = {
        "%": "pct",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    for char in [" ", "-", "/", "(", ")", ",", ".", ":", "[", "]"]:
        normalized = normalized.replace(char, "_")
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def prepare_dataframe(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = [to_snake(column) for column in frame.columns]
    frame = frame.dropna(how="all")
    return frame


def standardize_columns(frame: pd.DataFrame, ordered_columns: list[str]) -> pd.DataFrame:
    frame = frame.copy()
    for column in ordered_columns:
        if column not in frame.columns:
            frame[column] = None
    return frame[ordered_columns]


def load_production_history(data_dir: Path) -> pd.DataFrame:
    datasets = [
        ("tahil", "Detayli_Tahil_Verisi_Yatay.xlsx"),
        ("meyve", "Detayli_Meyve_Tam_Yatay.xlsx"),
        ("sebze", "Detayli_Sebze_Tam_Yatay.xlsx"),
    ]
    frames = []
    column_map = {
        "yil": "year",
        "sehir_adi": "city_name",
        "plaka_kodu": "plate_code",
        "urun_kodu": "product_code",
        "urun_adi": "product_name",
        "uretim_yontemi": "production_method",
        "ekilen_alan_dekar": "area_decare",
        "alan_dekar": "area_decare",
        "hasat_edilen_alan_dekar": "harvested_area_decare",
        "verim_kg_dekar": "yield_kg_decare",
        "verim_kg_meyve_veren_agac": "yield_kg_per_tree",
        "uretim_miktari_ton": "production_ton",
        "meyve_veren_yasta_agac_sayisi_adet_sayisi": "fruit_bearing_tree_count",
        "meyve_vermeyen_yasta_agac_sayisi_adet_sayisi": "non_bearing_tree_count",
        "toplu_meyveliklerin_alani_dekar": "orchard_area_decare",
    }
    ordered_columns = [
        "category_name",
        "year",
        "city_name",
        "plate_code",
        "product_code",
        "product_name",
        "production_method",
        "area_decare",
        "harvested_area_decare",
        "yield_kg_decare",
        "yield_kg_per_tree",
        "production_ton",
        "fruit_bearing_tree_count",
        "non_bearing_tree_count",
        "orchard_area_decare",
        "source_file",
    ]

    for category, file_name in datasets:
        frame = pd.read_excel(data_dir / file_name)
        frame = prepare_dataframe(frame).rename(columns=column_map)
        frame["category_name"] = category
        frame["source_file"] = file_name
        frame = standardize_columns(frame, ordered_columns)
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def load_climate_history(data_dir: Path) -> pd.DataFrame:
    frame = pd.read_excel(data_dir / "Turkiye_81_Il_Tarimsal_Iklim_2013_2024.xlsx")
    frame = prepare_dataframe(frame).rename(
        columns={
            "tarih": "observation_date",
            "sehir": "city_name",
            "sicaklik_ort_c": "temperature_avg_c",
            "yagis_mm": "rainfall_mm",
            "ruzgar_hizi": "wind_speed",
            "toprak_nemi_pct": "soil_moisture_pct",
        }
    )
    frame["source_file"] = "Turkiye_81_Il_Tarimsal_Iklim_2013_2024.xlsx"
    ordered_columns = [
        "observation_date",
        "city_name",
        "temperature_avg_c",
        "rainfall_mm",
        "wind_speed",
        "soil_moisture_pct",
        "source_file",
    ]
    return standardize_columns(frame, ordered_columns)


def load_consumption_history(data_dir: Path) -> pd.DataFrame:
    frames = []
    ordered_columns = [
        "year",
        "geography_name",
        "category_name",
        "product_name",
        "metric_name",
        "value",
        "record_type",
        "source_group",
        "population_value",
        "index_average",
        "household_income",
        "lag1",
        "rolling_mean3",
        "lag1_log",
        "rolling_mean3_log",
        "trend",
        "source_file",
        "source_sheet",
    ]

    simple_files = [
        ("tuketim_meyve.xlsx", "meyve"),
        ("tuketim_sebze.xlsx", "sebze"),
        ("tuketim_tahil.xlsx", "tahil"),
    ]
    for file_name, source_group in simple_files:
        frame = pd.read_excel(data_dir / file_name)
        frame = prepare_dataframe(frame).rename(
            columns={
                "yil": "year",
                "sehir_adi": "geography_name",
                "ulke": "geography_name",
                "kategori": "metric_name",
                "urun_adi": "product_name",
                "deger": "value",
            }
        )
        frame["category_name"] = None
        frame["record_type"] = "Gercek"
        frame["source_group"] = source_group
        frame["source_file"] = file_name
        frame["source_sheet"] = Path(file_name).stem
        frame = standardize_columns(frame, ordered_columns)
        frames.append(frame)

    forecast_file = data_dir / "tuketim_tahminleri_2024_2027v3.xlsx"
    for sheet_name in ["Tahminler", "Gercek_Veriler", "Tum_Veriler"]:
        frame = pd.read_excel(forecast_file, sheet_name=sheet_name)
        frame = prepare_dataframe(frame).rename(
            columns={
                "yil": "year",
                "urun_adi": "product_name",
                "tuketim": "value",
                "tip": "record_type",
                "ana_kategori": "category_name",
                "nufus": "population_value",
                "endeks_ortalama": "index_average",
                "hanehalki_gelir": "household_income",
                "rollingmean3": "rolling_mean3",
                "rollingmean3_log": "rolling_mean3_log",
            }
        )
        frame["geography_name"] = "Turkiye"
        frame["metric_name"] = "Tuketim"
        frame["source_group"] = "tahmin_bilesik"
        frame["source_file"] = forecast_file.name
        frame["source_sheet"] = sheet_name
        frame = standardize_columns(frame, ordered_columns)
        frames.append(frame)

    combined_file = data_dir / "tuketim_ve_tahmin_birlesik.xlsx"
    for sheet_name in [
        "Meyve_Gercek",
        "Sebze_Gercek",
        "Tahil_Gercek",
        "Gercek_Birlesik",
        "Tahminler",
        "Tahmin_Dosyasi_TumVeri",
        "Gercek_ve_Tahmin_Birlesik",
    ]:
        frame = pd.read_excel(combined_file, sheet_name=sheet_name)
        frame = prepare_dataframe(frame).rename(
            columns={
                "yil": "year",
                "urun_adi": "product_name",
                "tuketim": "value",
                "tip": "record_type",
                "kaynak": "source_group",
            }
        )
        frame["geography_name"] = "Turkiye"
        frame["metric_name"] = "Tuketim"
        if "source_group" not in frame.columns:
            frame["source_group"] = sheet_name
        frame["source_file"] = combined_file.name
        frame["source_sheet"] = sheet_name
        frame = standardize_columns(frame, ordered_columns)
        frames.append(frame)

    return pd.concat(frames, ignore_index=True)


def load_population_history(data_dir: Path) -> pd.DataFrame:
    file_name = "Nufus (1).xlsx"
    frame = pd.read_excel(data_dir / file_name, sheet_name=0, header=1)
    frame = prepare_dataframe(frame).rename(
        columns={
            "yil": "year",
            "duzey": "level_name",
            "toplam": "total_population",
            "erkek": "male_population",
            "kadin": "female_population",
        }
    )
    frame = frame[frame["year"].notna()].copy()
    frame["source_file"] = file_name
    frame["source_sheet"] = "Cinsiyete Gore Nufus"
    ordered_columns = [
        "year",
        "level_name",
        "total_population",
        "male_population",
        "female_population",
        "source_file",
        "source_sheet",
    ]
    return standardize_columns(frame, ordered_columns)


def load_income_history(data_dir: Path) -> pd.DataFrame:
    income_path = next(data_dir.glob("Y*Hanehalk*xlsx"))
    frame = pd.read_excel(income_path, header=None)
    geography_name = frame.iloc[1, 3] or "Turkiye-TR"
    rows = []
    current_income_type = None
    for _, row in frame.iloc[4:].iterrows():
        income_type = row[1] if pd.notna(row[1]) else current_income_type
        year = row[2]
        amount = row[3]
        if pd.notna(income_type):
            current_income_type = income_type
        if pd.isna(year) or pd.isna(amount) or current_income_type is None:
            continue
        rows.append(
            {
                "year": int(year),
                "geography_name": str(geography_name),
                "income_type": str(current_income_type).replace("Gelir tipleri:", ""),
                "income_amount": amount,
                "source_file": income_path.name,
                "source_sheet": "Sheet0",
            }
        )
    return pd.DataFrame(rows)


def load_model_predictions(data_dir: Path) -> pd.DataFrame:
    file_name = "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx"
    ordered_columns = [
        "model_name",
        "model_version",
        "category_name",
        "city_name",
        "product_name",
        "production_method",
        "year",
        "predicted_production_ton",
        "origin_year",
        "forecast_horizon",
        "delta_log_used",
        "delta_log_guard_lo",
        "delta_log_guard_hi",
        "vol_proxy",
        "source_file",
        "source_sheet",
    ]
    frames = []
    for sheet_name in ["Meyve", "Sebze", "Tahil"]:
        frame = pd.read_excel(data_dir / file_name, sheet_name=sheet_name)
        frame = prepare_dataframe(frame).rename(
            columns={
                "kategori": "category_name",
                "sehir_adi": "city_name",
                "urun_adi": "product_name",
                "uretim_yontemi": "production_method",
                "yil": "year",
                "tahmini_uretim_ton": "predicted_production_ton",
                "origin_yil": "origin_year",
            }
        )
        frame["model_name"] = MODEL_NAME
        frame["model_version"] = MODEL_VERSION
        frame["source_file"] = file_name
        frame["source_sheet"] = sheet_name
        frame = standardize_columns(frame, ordered_columns)
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def load_walk_forward_metrics(data_dir: Path) -> pd.DataFrame:
    file_name = "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx"
    frame = pd.read_excel(data_dir / file_name, sheet_name="WalkForward_Metrikler")
    frame = prepare_dataframe(frame)
    frame["model_name"] = MODEL_NAME
    frame["model_version"] = MODEL_VERSION
    frame["source_file"] = file_name
    frame["source_sheet"] = "WalkForward_Metrikler"
    ordered_columns = [
        "model_name",
        "model_version",
        "origin_year",
        "forecast_year",
        "horizon",
        "r2",
        "mae",
        "rmse",
        "smape_pct",
        "wape_pct",
        "source_file",
        "source_sheet",
    ]
    return standardize_columns(frame, ordered_columns)


def load_walk_forward_predictions(data_dir: Path) -> pd.DataFrame:
    file_name = "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx"
    frame = pd.read_excel(data_dir / file_name, sheet_name="WalkForward_Tahminler")
    frame = prepare_dataframe(frame).rename(
        columns={
            "kategori": "category_name",
            "sehir_adi": "city_name",
            "urun_adi": "product_name",
            "uretim_yontemi": "production_method",
            "origin_yil": "origin_year",
            "gercek_uretim": "actual_production",
            "tahmin": "predicted_production",
        }
    )
    frame["model_name"] = MODEL_NAME
    frame["model_version"] = MODEL_VERSION
    frame["source_file"] = file_name
    frame["source_sheet"] = "WalkForward_Tahminler"
    ordered_columns = [
        "model_name",
        "model_version",
        "series_id",
        "category_name",
        "city_name",
        "product_name",
        "production_method",
        "origin_year",
        "forecast_year",
        "actual_production",
        "predicted_production",
        "delta_log_guard_lo",
        "delta_log_guard_hi",
        "horizon",
        "source_file",
        "source_sheet",
    ]
    return standardize_columns(frame, ordered_columns)


def refresh_reference_tables(importer: PostgresImporter) -> None:
    importer.run_psql(
        """
        TRUNCATE TABLE analytics.cities RESTART IDENTITY;
        INSERT INTO analytics.cities (city_name, plate_code)
        SELECT city_name, MAX(plate_code) AS plate_code
        FROM (
            SELECT city_name, plate_code
            FROM analytics.production_history
            UNION ALL
            SELECT city_name, NULL::integer AS plate_code
            FROM analytics.climate_history
        ) AS combined
        WHERE city_name IS NOT NULL
        GROUP BY city_name
        ORDER BY city_name;
        """
    )
    importer.run_psql(
        """
        TRUNCATE TABLE analytics.crop_catalog RESTART IDENTITY;
        INSERT INTO analytics.crop_catalog (category_name, product_code, product_name, production_method)
        SELECT DISTINCT category_name, product_code, product_name, production_method
        FROM analytics.production_history
        WHERE product_name IS NOT NULL
        ORDER BY category_name, product_name, production_method;
        """
    )


def insert_import_logs(importer: PostgresImporter, import_rows: list[dict[str, object]]) -> None:
    frame = pd.DataFrame(import_rows)
    importer.copy_dataframe(frame, "analytics.dataset_imports")


def truncate_analytics_tables(importer: PostgresImporter) -> None:
    importer.run_psql(
        """
        TRUNCATE TABLE
            analytics.dataset_imports,
            analytics.cities,
            analytics.crop_catalog,
            analytics.production_history,
            analytics.climate_history,
            analytics.consumption_history,
            analytics.population_history,
            analytics.income_history,
            analytics.model_predictions,
            analytics.walk_forward_metrics,
            analytics.walk_forward_predictions
        RESTART IDENTITY;
        """
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="veri klasorundeki Excel dosyalarini PostgreSQL'e aktarir.")
    parser.add_argument("--db-name", default=os.getenv("PGDATABASE", DEFAULT_DB_NAME))
    parser.add_argument("--db-user", default=os.getenv("PGUSER", DEFAULT_DB_USER))
    parser.add_argument("--pg-bin", default=os.getenv("POSTGRES_BIN", str(DEFAULT_PG_BIN)))
    parser.add_argument("--skip-create-db", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    data_dir = repo_root / "veri"
    schema_file = repo_root / "backend" / "db" / "schema.sql"

    importer = PostgresImporter(
        db_name=args.db_name,
        db_user=args.db_user,
        pg_bin=Path(args.pg_bin),
    )

    if not args.skip_create_db:
        importer.ensure_database()
    importer.run_psql_file(schema_file)
    truncate_analytics_tables(importer)

    production_history = load_production_history(data_dir)
    climate_history = load_climate_history(data_dir)
    consumption_history = load_consumption_history(data_dir)
    population_history = load_population_history(data_dir)
    income_history = load_income_history(data_dir)
    model_predictions = load_model_predictions(data_dir)
    walk_forward_metrics = load_walk_forward_metrics(data_dir)
    walk_forward_predictions = load_walk_forward_predictions(data_dir)

    importer.copy_dataframe(production_history, "analytics.production_history")
    importer.copy_dataframe(climate_history, "analytics.climate_history")
    importer.copy_dataframe(consumption_history, "analytics.consumption_history")
    importer.copy_dataframe(population_history, "analytics.population_history")
    importer.copy_dataframe(income_history, "analytics.income_history")
    importer.copy_dataframe(model_predictions, "analytics.model_predictions")
    importer.copy_dataframe(walk_forward_metrics, "analytics.walk_forward_metrics")
    importer.copy_dataframe(walk_forward_predictions, "analytics.walk_forward_predictions")

    refresh_reference_tables(importer)

    income_source = next(data_dir.glob("Y*Hanehalk*xlsx")).name
    import_rows = [
        {
            "dataset_name": "production_history",
            "source_file": "Detayli_Tahil_Verisi_Yatay.xlsx;Detayli_Meyve_Tam_Yatay.xlsx;Detayli_Sebze_Tam_Yatay.xlsx",
            "source_sheet": "Sheet1",
            "imported_table": "analytics.production_history",
            "row_count": int(len(production_history)),
        },
        {
            "dataset_name": "climate_history",
            "source_file": "Turkiye_81_Il_Tarimsal_Iklim_2013_2024.xlsx",
            "source_sheet": "Sheet1",
            "imported_table": "analytics.climate_history",
            "row_count": int(len(climate_history)),
        },
        {
            "dataset_name": "consumption_history",
            "source_file": "tuketim_meyve.xlsx;tuketim_sebze.xlsx;tuketim_tahil.xlsx;tuketim_tahminleri_2024_2027v3.xlsx;tuketim_ve_tahmin_birlesik.xlsx",
            "source_sheet": "multiple",
            "imported_table": "analytics.consumption_history",
            "row_count": int(len(consumption_history)),
        },
        {
            "dataset_name": "population_history",
            "source_file": "Nufus (1).xlsx",
            "source_sheet": "Cinsiyete Gore Nufus",
            "imported_table": "analytics.population_history",
            "row_count": int(len(population_history)),
        },
        {
            "dataset_name": "income_history",
            "source_file": income_source,
            "source_sheet": "Sheet0",
            "imported_table": "analytics.income_history",
            "row_count": int(len(income_history)),
        },
        {
            "dataset_name": "model_predictions",
            "source_file": "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx",
            "source_sheet": "Meyve;Sebze;Tahil",
            "imported_table": "analytics.model_predictions",
            "row_count": int(len(model_predictions)),
        },
        {
            "dataset_name": "walk_forward_metrics",
            "source_file": "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx",
            "source_sheet": "WalkForward_Metrikler",
            "imported_table": "analytics.walk_forward_metrics",
            "row_count": int(len(walk_forward_metrics)),
        },
        {
            "dataset_name": "walk_forward_predictions",
            "source_file": "Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx",
            "source_sheet": "WalkForward_Tahminler",
            "imported_table": "analytics.walk_forward_predictions",
            "row_count": int(len(walk_forward_predictions)),
        },
    ]
    insert_import_logs(importer, import_rows)

    print("Import tamamlandi.")
    print(f"production_history: {len(production_history)}")
    print(f"climate_history: {len(climate_history)}")
    print(f"consumption_history: {len(consumption_history)}")
    print(f"population_history: {len(population_history)}")
    print(f"income_history: {len(income_history)}")
    print(f"model_predictions: {len(model_predictions)}")
    print(f"walk_forward_metrics: {len(walk_forward_metrics)}")
    print(f"walk_forward_predictions: {len(walk_forward_predictions)}")


if __name__ == "__main__":
    main()
