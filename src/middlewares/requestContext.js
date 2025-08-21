import { AsyncLocalStorage } from 'async_hooks'

export const requestContext = new AsyncLocalStorage()

/**
 * Envuelve cada petición en un contexto aislado.
 */
export function contextMiddleware(req, res, next) {
  requestContext.run({ req }, () => next())
}

/**
* Recupera el objeto de usuario autenticado que puso authenticateJWT en el pipeline.
*
* @returns {{
*  id: number;
*   usuario: string;
*   displayName: string;
*   permisos: string[];
*   iat: number;
*   exp: number;
* }} Payload del JWT con la información del usuario actual.
* @throws {Error} Si no hay un usuario en el contexto de petición.
*/
export function getCurrentUser() {
  const store = requestContext.getStore()
  if (!store || !store.req || !store.req.user) {
    throw new Error('No hay user en el contexto de petición')
  }
  return store.req.user
}
