CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS app.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tc_identity_no varchar(11) UNIQUE,
    phone varchar(20) UNIQUE,
    email varchar(255) UNIQUE,
    password_hash text,
    full_name varchar(150) NOT NULL,
    city varchar(100),
    district varchar(100),
    member_since date,
    role varchar(30) NOT NULL DEFAULT 'farmer',
    active_badge boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE,
    remember_me boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app.users(id) ON DELETE CASCADE,
    name varchar(150) NOT NULL,
    city varchar(100),
    district varchar(100),
    region_code varchar(50),
    area_decare numeric(12, 2),
    soil_type varchar(100),
    latitude numeric(9, 6),
    longitude numeric(9, 6),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.production_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app.users(id) ON DELETE CASCADE,
    field_id uuid REFERENCES app.fields(id) ON DELETE CASCADE,
    selected_crop_name varchar(150),
    region_code varchar(50),
    season_year integer,
    status varchar(30) NOT NULL DEFAULT 'draft',
    target_yield_percent numeric(5, 2),
    planned_area_decare numeric(12, 2),
    planned_sowing_date date,
    planned_harvest_date date,
    city varchar(100),
    district varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.ai_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid REFERENCES app.production_plans(id) ON DELETE CASCADE,
    score numeric(5, 2),
    summary text,
    climate_comment text,
    market_comment text,
    model_name varchar(100),
    analyzed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.ai_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id uuid REFERENCES app.ai_analyses(id) ON DELETE CASCADE,
    rank_order integer NOT NULL,
    crop_name varchar(150) NOT NULL,
    expected_return_percent numeric(6, 2),
    reason text NOT NULL
);

CREATE TABLE IF NOT EXISTS app.alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app.users(id) ON DELETE CASCADE,
    field_id uuid REFERENCES app.fields(id) ON DELETE SET NULL,
    plan_id uuid REFERENCES app.production_plans(id) ON DELETE SET NULL,
    alert_type varchar(30) NOT NULL,
    title varchar(150),
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE app.production_plans ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE app.production_plans ADD COLUMN IF NOT EXISTS district varchar(100);

CREATE INDEX IF NOT EXISTS idx_users_phone ON app.users (phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON app.users (email);
CREATE INDEX IF NOT EXISTS idx_fields_user_id ON app.fields (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON app.production_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_city_year ON app.production_plans (city, season_year DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON app.alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON app.user_sessions (token_hash);

CREATE TABLE IF NOT EXISTS analytics.dataset_imports (
    id bigserial PRIMARY KEY,
    dataset_name varchar(150) NOT NULL,
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150),
    imported_table varchar(150) NOT NULL,
    row_count integer NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.cities (
    id bigserial PRIMARY KEY,
    city_name varchar(100) NOT NULL UNIQUE,
    plate_code integer
);

CREATE TABLE IF NOT EXISTS analytics.crop_catalog (
    id bigserial PRIMARY KEY,
    category_name varchar(50),
    product_code varchar(50),
    product_name varchar(150) NOT NULL,
    production_method varchar(100),
    UNIQUE NULLS NOT DISTINCT (category_name, product_code, product_name, production_method)
);

CREATE TABLE IF NOT EXISTS analytics.production_history (
    id bigserial PRIMARY KEY,
    category_name varchar(50) NOT NULL,
    year integer NOT NULL,
    city_name varchar(100) NOT NULL,
    plate_code integer,
    product_code varchar(50),
    product_name varchar(150) NOT NULL,
    production_method varchar(100),
    area_decare numeric(14, 2),
    harvested_area_decare numeric(14, 2),
    yield_kg_decare numeric(14, 2),
    yield_kg_per_tree numeric(14, 2),
    production_ton numeric(14, 2),
    fruit_bearing_tree_count numeric(14, 2),
    non_bearing_tree_count numeric(14, 2),
    orchard_area_decare numeric(14, 2),
    source_file varchar(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_production_history_year_city
    ON analytics.production_history (year, city_name);

CREATE TABLE IF NOT EXISTS analytics.climate_history (
    id bigserial PRIMARY KEY,
    observation_date date NOT NULL,
    city_name varchar(100) NOT NULL,
    temperature_avg_c numeric(10, 4),
    rainfall_mm numeric(12, 4),
    wind_speed numeric(12, 4),
    soil_moisture_pct numeric(12, 4),
    source_file varchar(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_climate_history_date_city
    ON analytics.climate_history (observation_date, city_name);

CREATE TABLE IF NOT EXISTS analytics.consumption_history (
    id bigserial PRIMARY KEY,
    year integer NOT NULL,
    geography_name varchar(100),
    category_name varchar(100),
    product_name varchar(150) NOT NULL,
    metric_name varchar(100),
    value numeric(18, 4),
    record_type varchar(50),
    source_group varchar(100),
    population_value numeric(18, 4),
    index_average numeric(18, 4),
    household_income numeric(18, 4),
    lag1 numeric(18, 4),
    rolling_mean3 numeric(18, 4),
    lag1_log numeric(18, 8),
    rolling_mean3_log numeric(18, 8),
    trend numeric(18, 4),
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);

CREATE INDEX IF NOT EXISTS idx_consumption_history_year_product
    ON analytics.consumption_history (year, product_name);

CREATE TABLE IF NOT EXISTS analytics.population_history (
    id bigserial PRIMARY KEY,
    year integer NOT NULL,
    level_name varchar(100) NOT NULL,
    total_population bigint,
    male_population bigint,
    female_population bigint,
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);

CREATE TABLE IF NOT EXISTS analytics.income_history (
    id bigserial PRIMARY KEY,
    year integer NOT NULL,
    geography_name varchar(100) NOT NULL,
    income_type varchar(200) NOT NULL,
    income_amount numeric(18, 2) NOT NULL,
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);

CREATE TABLE IF NOT EXISTS analytics.model_predictions (
    id bigserial PRIMARY KEY,
    model_name varchar(150) NOT NULL,
    model_version varchar(100),
    category_name varchar(50),
    city_name varchar(100),
    product_name varchar(150) NOT NULL,
    production_method varchar(100),
    year integer NOT NULL,
    predicted_production_ton numeric(18, 6) NOT NULL,
    origin_year integer,
    forecast_horizon integer,
    delta_log_used numeric(18, 10),
    delta_log_guard_lo numeric(18, 10),
    delta_log_guard_hi numeric(18, 10),
    vol_proxy numeric(18, 10),
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);

CREATE INDEX IF NOT EXISTS idx_model_predictions_year_product
    ON analytics.model_predictions (year, product_name);

CREATE TABLE IF NOT EXISTS analytics.walk_forward_metrics (
    id bigserial PRIMARY KEY,
    model_name varchar(150) NOT NULL,
    model_version varchar(100),
    origin_year integer NOT NULL,
    forecast_year integer NOT NULL,
    horizon integer NOT NULL,
    r2 numeric(18, 10),
    mae numeric(18, 6),
    rmse numeric(18, 6),
    smape_pct numeric(18, 6),
    wape_pct numeric(18, 6),
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);

CREATE TABLE IF NOT EXISTS analytics.walk_forward_predictions (
    id bigserial PRIMARY KEY,
    model_name varchar(150) NOT NULL,
    model_version varchar(100),
    series_id text,
    category_name varchar(50),
    city_name varchar(100),
    product_name varchar(150),
    production_method varchar(100),
    origin_year integer,
    forecast_year integer,
    actual_production numeric(18, 6),
    predicted_production numeric(18, 6),
    delta_log_guard_lo numeric(18, 10),
    delta_log_guard_hi numeric(18, 10),
    horizon integer,
    source_file varchar(255) NOT NULL,
    source_sheet varchar(150)
);
