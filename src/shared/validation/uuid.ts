/**
 * Any 8-4-4-4-12 hexadecimal identifier, as PostgreSQL's uuid type accepts it.
 * Stricter RFC 4122 checks would reject the fixed seed ids (see BORRADOR_DECISIONES.md, 0.4).
 */
export const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
