import { Viewer } from "../../shared/viewer";

export const AUTH_PORT = Symbol('AUTH_PORT');

export interface AuthPort {
  resolveViewer(bearerToken: string | undefined): Promise<Viewer>;
}