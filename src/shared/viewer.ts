export const ROLES = [
  'GUEST',
  'NIVEL_2_MINORISTA',
  'NIVEL_1_MAYORISTA',
  'NIVEL_0_FABRICANTE',
] as const;

export type Role = (typeof ROLES)[number]; 
export type AuthenticatedRole = Exclude<Role, 'GUEST'>;

export type Viewer =
  | { readonly kind: 'guest' }
  | {
    readonly kind: 'buyer';
    readonly buyerId: string;
    readonly role: AuthenticatedRole;
  };