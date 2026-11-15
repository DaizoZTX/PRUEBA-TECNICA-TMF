# DECISIONES

## Arquitectura

Separé el proyecto por módulos de negocio (`catalog`, `quotes`, `group-buying`, `auth`). Dentro de cada uno usé una estructura hexagonal: `domain/` con las reglas y los puertos, `application/` con los casos de uso y `adapters/` con HTTP y PostgreSQL. Las reglas de precio y de reserva viven en `domain/` y no importan NestJS, `pg` ni Express. Eso me permitió probar la lógica de precios sin base de datos, y si mañana cambiamos de base o de framework, solo se toca el adaptador. Los casos de uso sí usan los decoradores de Nest para la inyección de dependencias; lo dejé así a propósito.

No usé Prisma ni otro ORM. Las partes que importan de verdad, como el `UPDATE` condicional para el cupo o el `ON CONFLICT` para la idempotencia, son SQL concreto. Con un ORM tendría que escribir esas consultas igual con `$queryRaw`, así que el ORM solo agregaba una capa más. Preferí escribir las migraciones en SQL propio.

## Muro de privacidad

Quería que fuera imposible filtrar precios por accidente, no que dependiera de acordarse de un `if`. Por eso el puerto del catálogo está partido en dos: `searchPublic` no recibe nivel y no toca precios, y `searchPriced` exige un nivel. No existe ningún método que devuelva precios de todos los niveles. Si alguien quiere mostrar precios, tiene que elegir explícitamente uno de los dos métodos, y eso se nota en la revisión.

Para el invitado, si manda un filtro de precio respondo 400 en vez de ignorarlo. Ignorarlo daría resultados engañosos sin avisar.

## Autenticación

Usé JWT firmado con HS256 en vez del header `x-user-role`. Un header lo puede mandar cualquiera; un JWT firmado con el secreto del servidor no se puede falsificar sin conocerlo. Fijé el algoritmo, así que un token sin firma (`alg: none`) se rechaza. Los tokens duran 15 minutos. No hay revocación: con esa vida corta el riesgo es chico, pero lo menciono como límite.

## Concurrencia y reservas

La reserva corre en una transacción. Primero inserto la clave de idempotencia; si ya existe, devuelvo la reserva guardada. Después hago un `UPDATE` que solo suma al cupo si `reserved + cantidad <= total_capacity`. Si no afecta filas, revierto todo. Elegí esto sobre un `SELECT ... FOR UPDATE` porque es un solo paso y deja menos lugar a errores. Las pruebas de concurrencia lanzan 30 compradores contra 100 unidades y el resultado es exactamente 10 reservas.

Para la idempotencia uso la cabecera `Idempotency-Key`, con un `UNIQUE` en la base sobre comprador, lote y clave. El orden importa: primero resuelvo si es un reintento y después reviso el cupo, así un reintento de una reserva que ya llenó el lote sigue devolviendo 200.

## Dinero

Los precios están en `numeric(12,2)` en la base, y los cálculos los hago en centavos enteros. Con `float` hay errores de redondeo que en una proforma se notan.

## Códigos HTTP

- 201 cuando la reserva consume cupo, 200 cuando es un reintento.
- 422 para reglas de negocio que la petición no cumple (bajo MOQ, sin precio para el nivel, clave usada con otra cantidad).
- 409 para conflictos de estado (lote cerrado, sin cupo).
- 403 para operaciones de comprador sin token de comprador.

## Validación y seguridad básica

Todos los DTOs tienen `whitelist` y `forbidNonWhitelisted`, así que un campo de más (por ejemplo `price`) devuelve 400. Agregué límites: máximo 50 líneas por proforma, 100 000 unidades por línea, JSON de 10 kB. Usé `helmet` para las cabeceras.

## Infraestructura

El Dockerfile tiene dos etapas y corre como usuario `node`, así la imagen final no trae código fuente ni `.env`. La API espera a que la base esté sana antes de arrancar. Publiqué PostgreSQL en el puerto 5433 porque el 5432 ya estaba ocupado en mi máquina por una instalación nativa.

## Datos de prueba

Los IDs del seed son fijos (`00000000-0000-0000-0000-00000000000N`) para poder usarlos en `curl` y en Bruno. Son predecibles, así que solo sirven para pruebas.

## Respuestas a las preguntas del enunciado

**¿Cómo evité que un dev futuro filtre precios?** Con la forma del puerto: el método público no tiene forma de llegar a precios, y el método con precios exige nivel. Además, una prueba de arquitectura protege las capas.

**¿Qué mecanismo usé para la concurrencia y qué cambiaría con varias instancias?** Un `UPDATE` condicional dentro de una transacción, más una clave única para la idempotencia. La garantía vive en PostgreSQL, así que con varias instancias de la API sigue siendo correcta. Lo que cambiaría con demanda muy alta es el volumen: pondría un contador en Redis con un script atómico, o una cola por lote.

## Límites conocidos

- La cabecera `Authorization` distingue mayúsculas: `bearer` en minúsculas se rechaza.
- Los tramos de un mismo producto y nivel no pueden solaparse. Lo impide una restricción de exclusión en la base (`migrations/002_no_overlap.sql`), con prueba de integración.
- `buyer_id` no tiene clave foránea porque no hay tabla de usuarios.
- No hay limitación de peticiones.
- No hay revocación de tokens.
