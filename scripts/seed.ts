import { Client, ClientConfig } from 'pg';
import { loadDbConfig } from './lib/db-config';

const PRICE_LEVELS = ['NIVEL_0_FABRICANTE', 'NIVEL_1_MAYORISTA', 'NIVEL_2_MINORISTA'] as const;
type PriceLevel = (typeof PRICE_LEVELS)[number];

const FIRST_TIER_MAX_QTY = 49;
const BULK_TIER_MIN_QTY = 50;

interface SeedProduct {
  readonly id: string;
  readonly sku: string;
  readonly technicalName: string;
  readonly brand: string;
  readonly moq: number;
  readonly stock: number;
  readonly specs: Record<string, string>;
  readonly prices: Record<PriceLevel, readonly [string, string]>;
}

interface SeedLot {
  readonly id: string;
  readonly productId: string;
  readonly totalCapacity: number;
}

const PRODUCTS: readonly SeedProduct[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    sku: 'TOR-001',
    technicalName: 'Tornillo autorroscante 6x1 in',
    brand: 'FerroMax',
    moq: 10,
    stock: 5000,
    specs: { diametro: '6 mm', longitud: '1 in' },
    prices: {
      NIVEL_2_MINORISTA: ['8.50', '7.20'],
      NIVEL_1_MAYORISTA: ['7.80', '6.60'],
      NIVEL_0_FABRICANTE: ['6.00', '5.40'],
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    sku: 'TAL-002',
    technicalName: 'Taladro percutor 13 mm 600 W',
    brand: 'PowerTool',
    moq: 2,
    stock: 40,
    specs: { potencia: '600 W', mandril: '13 mm' },
    prices: {
      NIVEL_2_MINORISTA: ['95.00', '88.00'],
      NIVEL_1_MAYORISTA: ['88.00', '81.00'],
      NIVEL_0_FABRICANTE: ['72.00', '66.00'],
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    sku: 'PIN-003',
    technicalName: 'Pintura vinílica blanca 19 L',
    brand: 'ColorPlus',
    moq: 4,
    stock: 120,
    specs: { acabado: 'mate', volumen: '19 L' },
    prices: {
      NIVEL_2_MINORISTA: ['42.00', '38.50'],
      NIVEL_1_MAYORISTA: ['39.00', '35.00'],
      NIVEL_0_FABRICANTE: ['31.00', '28.00'],
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    sku: 'LLA-004',
    technicalName: 'Llave combinada 13 mm',
    brand: 'ToolPro',
    moq: 6,
    stock: 300,
    specs: { medida: '13 mm', material: 'acero cromo vanadio' },
    prices: {
      NIVEL_2_MINORISTA: ['6.20', '5.40'],
      NIVEL_1_MAYORISTA: ['5.70', '4.90'],
      NIVEL_0_FABRICANTE: ['4.10', '3.60'],
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    sku: 'TUB-005',
    technicalName: 'Tubo PVC 1/2 in x 3 m',
    brand: 'AquaFlow',
    moq: 20,
    stock: 800,
    specs: { diametro: '1/2 in', longitud: '3 m' },
    prices: {
      NIVEL_2_MINORISTA: ['4.80', '4.10'],
      NIVEL_1_MAYORISTA: ['4.40', '3.80'],
      NIVEL_0_FABRICANTE: ['3.20', '2.90'],
    },
  },
];

const SEED_LOT: SeedLot = {
  id: '00000000-0000-0000-0000-000000000010',
  productId: '00000000-0000-0000-0000-000000000001',
  totalCapacity: 100,
};

async function insertProduct(client: Client, product: SeedProduct): Promise<void> {
  await client.query(
    `INSERT INTO products (id, sku, technical_name, brand, specs, moq, stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [
      product.id,
      product.sku,
      product.technicalName,
      product.brand,
      JSON.stringify(product.specs),
      product.moq,
      product.stock,
    ],
  );
}

async function insertPriceTier(
  client: Client,
  productId: string,
  level: PriceLevel,
  minQty: number,
  maxQty: number | null,
  unitPrice: string,
): Promise<void> {
  await client.query(
    `INSERT INTO price_tiers (id, product_id, level, min_qty, max_qty, unit_price)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     ON CONFLICT (product_id, level, min_qty) DO NOTHING`,
    [productId, level, minQty, maxQty, unitPrice],
  );
}

async function insertPriceTiers(client: Client, product: SeedProduct): Promise<void> {
  for (const level of PRICE_LEVELS) {
    const [firstTierPrice, bulkTierPrice] = product.prices[level];
    await insertPriceTier(client, product.id, level, product.moq, FIRST_TIER_MAX_QTY, firstTierPrice);
    await insertPriceTier(client, product.id, level, BULK_TIER_MIN_QTY, null, bulkTierPrice);
  }
}

async function insertLot(client: Client, lot: SeedLot): Promise<void> {
  await client.query(
    `INSERT INTO group_buy_lots (id, product_id, total_capacity, reserved, status)
     VALUES ($1, $2, $3, 0, 'ACTIVE')
     ON CONFLICT DO NOTHING`,
    [lot.id, lot.productId, lot.totalCapacity],
  );
}

/** Loads the demo catalog and lot in one transaction. Safe to run repeatedly. */
export async function runSeed(config: ClientConfig): Promise<void> {
  const client = new Client(config);

  await client.connect();
  try {
    await client.query('BEGIN');
    for (const product of PRODUCTS) {
      await insertProduct(client, product);
      await insertPriceTiers(client, product);
    }
    await insertLot(client, SEED_LOT);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  process.loadEnvFile('.env');
  runSeed(loadDbConfig())
    .then(() => console.log(`seed loaded: ${PRODUCTS.length} products, 1 group-buy lot`))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
