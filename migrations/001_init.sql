CREATE TYPE price_level AS ENUM ('NIVEL_0_FABRICANTE', 'NIVEL_1_MAYORISTA', 'NIVEL_2_MINORISTA');
CREATE TYPE lot_status AS ENUM ('ACTIVE', 'CLOSED');

CREATE TABLE products (
    id uuid PRIMARY KEY,
    sku text NOT NULL UNIQUE,
    technical_name text NOT NULL,
    brand text NOT NULL,
    specs jsonb NOT NULL DEFAULT '{}'::jsonb,
    moq integer NOT NULL CHECK (moq > 0),
    stock integer NOT NULL CHECK (stock >= 0)
);

CREATE TABLE price_tiers (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    level price_level NOT NULL,
    min_qty integer NOT NULL CHECK (min_qty > 0),
    max_qty integer CHECK (max_qty IS NULL OR max_qty >= min_qty),
    unit_price numeric(12, 2) NOT NULL CHECK (unit_price > 0),
    UNIQUE (product_id, level, min_qty)
);

CREATE TABLE group_buy_lots (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES products(id),
    total_capacity integer NOT NULL CHECK (total_capacity > 0),
    reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    status lot_status NOT NULL DEFAULT 'ACTIVE',
    CHECK (reserved <= total_capacity)
);

CREATE TABLE reservations (
    id uuid PRIMARY KEY,
    lot_id uuid NOT NULL REFERENCES group_buy_lots(id),
    buyer_id uuid NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lot_id, buyer_id, idempotency_key)
);
