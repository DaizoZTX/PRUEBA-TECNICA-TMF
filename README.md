# TMF: Micro-módulo backend (catálogo, cotizador y compra agrupada)

Prueba técnica para **Tu Mercado Ferretero (TMF)**. Tres endpoints que resuelven:

1. **Catálogo protegido:** los precios y el stock solo se muestran a compradores, y cada nivel ve únicamente sus propios precios.
2. **Cotizador MOQ:** valida el pedido mínimo y calcula la proforma con el tramo de precio correcto.
3. **Reserva concurrente en compra agrupada:** sin sobreventa bajo concurrencia e idempotente ante reintentos.

## Requisitos

- Docker y Docker Compose
- Node.js 22 o superior (solo para los scripts de migración, seed y pruebas)

## Puesta en marcha

1. Crea tu archivo de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   Cambia `POSTGRES_PASSWORD` y `JWT_SECRET`. El secreto debe tener al menos 32 caracteres. Mantén `DB_HOST=localhost` y `DB_PORT=5433`: son para los scripts que corren en tu máquina.

2. Levanta la base de datos y la API:

   ```bash
   docker compose up -d --build
   ```

   `api` espera a que `db` esté sana antes de arrancar. La API queda en `http://localhost:3000/api`.

3. Crea el esquema y los datos de prueba (desde tu máquina):

   ```bash
   npm install
   npm run migrate
   npm run seed
   ```

   Ambos comandos son repetibles: ejecutarlos de nuevo no duplica nada.

## Pruebas

```bash
npm test          # pruebas unitarias, de integración y de arquitectura (base tmf_test)
npm run typecheck # comprobación estricta de src, test y scripts
bash scripts/api-curl-matrix.sh   # 79 comprobaciones contra la API en marcha
```

Para probar a mano con Bruno, sigue [`docs/GUIA_PRUEBAS.md`](docs/GUIA_PRUEBAS.md) y abre la carpeta `bruno/`.

Incluye pruebas unitarias de la lógica de precios, de la idempotencia y del caso de uso de compra agrupada, y pruebas de integración contra la base de datos: el muro de privacidad del catálogo y la concurrencia de las reservas. Las pruebas de integración necesitan la base levantada y migrada.

## Obtener un token de prueba

Los tokens se emiten con un script, porque el enunciado no pide un servicio de login:

```bash
npm run token -- NIVEL_2_MINORISTA c0000000-0000-0000-0000-000000000001
```

Roles válidos: `NIVEL_2_MINORISTA`, `NIVEL_1_MAYORISTA`, `NIVEL_0_FABRICANTE`. El segundo argumento es el identificador del comprador (`sub` del token).

## Endpoints

### `GET /api/catalog/products`

Sin token, el invitado recibe solo datos públicos. Con token, el comprador recibe además MOQ, stock y los tramos de su nivel.

```bash
# Invitado: sin precios ni stock
curl "http://localhost:3000/api/catalog/products?text=TOR"

# Comprador: con sus precios
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/catalog/products?text=TOR"
```

Parámetros: `text`, `minPrice`, `maxPrice` (solo para compradores), `limit` (1 a 100) y `offset`.

### `POST /api/quotes/calculate`

Requiere token de comprador. Calcula la proforma con el tramo que corresponde a la cantidad y al nivel.

```bash
curl -X POST http://localhost:3000/api/quotes/calculate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"00000000-0000-0000-0000-000000000001","quantity":60}]}'
```

Los importes van en centavos enteros.

### `POST /api/group-buying/:lotId/reserve`

Requiere token de comprador y la cabecera `Idempotency-Key`. Un reintento con la misma clave devuelve la reserva guardada y no consume cupo otra vez.

```bash
curl -X POST http://localhost:3000/api/group-buying/00000000-0000-0000-0000-000000000010/reserve \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"quantity":10}'
```

- `201`: la reserva consumió cupo.
- `200`: es un reintento de una reserva anterior.

## Códigos de error

Todas las respuestas de error tienen la forma `{ "code": "...", "message": "..." }`.

| Código | HTTP | Cuándo |
|---|---|---|
| `INVALID_TOKEN` | 401 | Token alterado, expirado o con otro esquema |
| `BUYER_REQUIRED` | 403 | Operación de comprador sin token de comprador |
| `PRICE_FILTER_NOT_ALLOWED` | 400 | Invitado que filtra por precio |
| `DUPLICATE_PRODUCT` | 400 | Mismo producto dos veces en una proforma |
| `INVALID_IDEMPOTENCY_KEY` | 400 | Falta la cabecera o es inválida |
| `PRODUCT_NOT_FOUND` | 404 | Producto inexistente |
| `LOT_NOT_FOUND` | 404 | Lote inexistente |
| `BELOW_MOQ` | 422 | Cantidad menor al pedido mínimo |
| `NO_PRICE_FOR_LEVEL` | 422 | El nivel no tiene precio para esa cantidad |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Misma clave con otra cantidad |
| `LOT_NOT_ACTIVE` | 409 | Lote cerrado |
| `CAPACITY_EXCEEDED` | 409 | No queda cupo suficiente |

## Estructura del código

El código sigue arquitectura hexagonal por módulo: `domain/` no depende de NestJS, `pg` ni Express.

```
src/
  auth/          identidad: JWT y guard global
  catalog/       catálogo protegido por nivel
  quotes/        cotizador MOQ
  group-buying/  reserva concurrente e idempotente
  database/      pool de PostgreSQL
  shared/        errores de dominio, tipo Viewer y filtro HTTP
migrations/      esquema SQL, aplicado en orden por scripts/migrate.ts
scripts/         migrate, seed y emisión de tokens de prueba
test/            pruebas unitarias e de integración
```

## Límites conocidos

- Las pruebas de integración usan la base de desarrollo, no una base separada.
- No hay servicio de login: los tokens se emiten con `npm run token`.
- Los identificadores de los datos de prueba son fijos y predecibles. Son aceptables para pruebas, no para producción.
