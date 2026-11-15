# DECISIONES.md — Borrador

> **Nota:** este archivo es un borrador guía. Las respuestas las escribes tú, con tus palabras (máximo 1 página).
> Los párrafos entre `[corchetes]` son preguntas para pensar, no texto para copiar.

## 1. Modelo de datos y arquitectura: cómo evitar filtrar precios

[¿Qué tablas tienes? ¿Los precios están en una tabla separada por nivel o en una sola tabla con columna `nivel`?]

[¿Dónde se aplica el filtro de nivel: en la consulta SQL, en el repositorio o en el controlador? ¿Por qué ahí?]

[Si mañana alguien crea un endpoint nuevo, ¿qué le impide olvidar el filtro? ¿Qué le obliga a pasar por el mecanismo correcto?]

[¿Cómo identificas al usuario (JWT o `x-user-role`)? ¿Qué limitación tiene tu elección fuera de la prueba?]

## 2. Mecanismo de concurrencia en la compra agrupada

[¿Qué mecanismo usaste para evitar sobreventa: bloqueo pesimista (`FOR UPDATE`), `UPDATE` condicional, optimistic locking u otro?]

[¿Cómo garantizas idempotencia ante doble clic o reintento de red? ¿Usas una clave de idempotencia, un `UNIQUE` sobre (comprador, lote, solicitud) o ambos?]

[¿Qué pasa si dos peticiones con la misma clave llegan al mismo milisegundo?]

[**Escalado a múltiples instancias:** si tienes 3 instancias de la API, ¿tu solución sigue funcionando? ¿Qué cambiarías (p. ej. todo en PostgreSQL vs. Redis con lock distribuido) y por qué?]

## 3. Trade-offs y lo que dejaste fuera

[¿Qué no hiciste por falta de tiempo y qué harías con más tiempo?]

[¿Qué decisión tomaste que cambiarías si la revisaras de nuevo?]
