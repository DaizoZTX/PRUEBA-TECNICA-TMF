# Guía de pruebas manuales

Hay dos formas de probar la API a mano. Bruno sirve para ir paso a paso y ver la respuesta. El script de curl ejecuta todo de una vez y dice qué pasó y qué no.

Los nombres de las pruebas (C01, Q02, G10...) son los mismos en Bruno y en el script, así que si algo falla en uno puedes buscarlo en el otro.

## Antes de empezar

Levanta la base y la API, y carga los datos:

    docker compose up -d --build
    npm install
    npm run migrate
    npm run seed

Para confirmar que la API responde:

    curl http://localhost:3000/api/catalog/products

Debe devolver 200 con una lista de productos.

## Bruno

Abre Bruno, elige "Open Collection" y selecciona la carpeta `bruno/` del proyecto. Luego escoge el entorno "Local", arriba a la derecha.

Los tokens no están en la colección, hay que generarlos y pegarlos en el entorno. Un token por rol:

    npm run token -- NIVEL_2_MINORISTA c0000000-0000-0000-0000-000000000001
    npm run token -- NIVEL_1_MAYORISTA c0000000-0000-0000-0000-000000000002
    npm run token -- NIVEL_0_FABRICANTE c0000000-0000-0000-0000-000000000003

El primero va en `tokenMinorista`, el segundo en `tokenMayorista` y el tercero en `tokenFabricante`.

Para las pruebas de seguridad hacen falta tokens inválidos a propósito. Se generan con el mismo secreto del proyecto:

    node scripts/forge-token.js guest-role
    node scripts/forge-token.js expired
    node scripts/forge-token.js alg-none

Cada salida va en su variable: `tokenForjadoGuest`, `tokenExpirado` y `tokenAlgNone`.

Para la prueba de lote cerrado hay que crear un lote cerrado en la base:

    docker compose exec -T db psql -U tmf -d tmf -c "INSERT INTO group_buy_lots (id, product_id, total_capacity, reserved, status) VALUES ('00000000-0000-0000-0000-0000000000cc','00000000-0000-0000-0000-000000000001',100,0,'CLOSED') ON CONFLICT DO NOTHING"

Las peticiones de Bruno tienen un número al principio del nombre. Conviene correrlas en ese orden dentro de cada carpeta, sobre todo en `compra-agrupada`: la 04 depende de la 03.

### Reiniciar el lote de Bruno

Cada reserva consume cupo, así que si repites la colección el lote se llena. Para dejarlo como al principio:

    docker compose exec -T db psql -U tmf -d tmf -c "DELETE FROM reservations WHERE lot_id='00000000-0000-0000-0000-000000000010'; UPDATE group_buy_lots SET reserved=0, status='ACTIVE' WHERE id='00000000-0000-0000-0000-000000000010'"

## Script de curl

Desde la raíz del proyecto:

    bash scripts/api-curl-matrix.sh

Imprime una línea por prueba, con PASS o FAIL, y al final el total. Si algo falla, muestra el código que llegó y el inicio del cuerpo de la respuesta. El script crea sus propios lotes y los borra al terminar, así que no hay que reiniciar nada después.

Hay 79 pruebas. Pasan todas con el código actual.

## Qué esperar en el catálogo

Como invitado, la lista trae el nombre técnico, el SKU, la marca y las especificaciones. No trae stock, ni MOQ, ni tramos de precio.

Como comprador sí trae stock y MOQ, pero solo los tramos de su nivel. TOR-001 tiene dos tramos por nivel: del 10 al 49 y del 50 en adelante. Para el minorista son 850 y 720 centavos, para el mayorista 780 y 660, y para el fabricante 600 y 540.

Los filtros de precio funcionan así. El producto aparece si alguno de sus tramos del nivel del comprador cae dentro del rango. Por ejemplo, un minorista que pide precios entre 6 y 6 dólares no encuentra TOR-001, porque su tramo más bajo es 7.20. Un fabricante sí lo encuentra, porque tiene 6.00.

Un invitado que mande `minPrice` o `maxPrice` recibe 400, con el código `PRICE_FILTER_NOT_ALLOWED`. Preferí rechazarlo antes que ignorar el filtro en silencio, porque el resultado sería engañoso.

## Qué esperar en el cotizador

Los importes van en centavos. Con 60 unidades de TOR-001, el minorista paga 720 por unidad, así que el total es 43200. El mayorista paga 660 y el total es 39600. El fabricante paga 540 y el total es 32400.

Los límites de tramo son exactos: 49 unidades siguen en el primer tramo, y 50 pasan al segundo. Con 49 el minorista paga 41650, y con 50 paga 36000.

El MOQ de TOR-001 es 10. Pedir 9 da 422 con `BELOW_MOQ`. TAL-002 tiene MOQ 2, así que pedir 2 es válido y pedir 1 no.

Si una proforma repite un producto, la respuesta es 400. Si un producto no existe, 404. Si la lista tiene más de 50 líneas, la cantidad es 0 o pasa de 100000, o aparece un campo que no esperamos como `price`, la respuesta es 400.

Un cuerpo de más de 10 kB devuelve 413.

## Qué esperar en la compra agrupada

El lote 0010 tiene capacidad 100. Las pruebas usan cantidades que suman o superan ese número para ver cada caso.

La primera reserva devuelve 201 con `replayed: false`. Si mandas exactamente la misma petición con la misma clave, devuelve 200 con `replayed: true` y no consume cupo otra vez.

Si reutilizas una clave con otra cantidad, la respuesta es 422 con `IDEMPOTENCY_KEY_REUSED`. La clave pertenece al comprador: otro comprador puede usar la misma clave sin problema y recibe 201.

Si pides más unidades de las que quedan, sale 409 con `CAPACITY_EXCEEDED`. Si el lote queda exactamente lleno, la reserva que lo llena sigue siendo 201. Después, cualquier comprador nuevo recibe 409, pero el reintento de la reserva que llenó el lote sigue devolviendo 200, porque ya existía.

Un lote cerrado devuelve 409 con `LOT_NOT_ACTIVE`. Un invitado que intenta reservar en un lote cerrado recibe 403, porque la autenticación se revisa antes que el estado del lote.

La cabecera `Idempotency-Key` es obligatoria. Si falta, está vacía, tiene más de 128 caracteres o trae espacios, la respuesta es 400.

## Seguridad

Estos casos deben dar 401 con `INVALID_TOKEN`: firma alterada, esquema distinto de Bearer, Bearer sin token, rol `GUEST` dentro del token, token expirado, `sub` que no es UUID, token firmado con otro secreto y token sin firma (`alg none`).

Una ruta que no existe responde 404. Las respuestas traen las cabeceras de helmet, por ejemplo `X-Content-Type-Options`, y no traen `X-Powered-By`.

## Lo que estas pruebas no cubren

No hay concurrencia real en Bruno ni en el script: las peticiones van una tras otra. La concurrencia la cubren las pruebas automáticas, con `npm test`, que lanzan muchas reservas a la vez contra PostgreSQL.

Tampoco se prueba la cabecera `Authorization` en minúsculas, como `bearer`. El estándar la acepta, pero el guard solo reconoce `Bearer` con la mayúscula exacta. Es una diferencia pequeña, y los clientes normales envían `Bearer`.
