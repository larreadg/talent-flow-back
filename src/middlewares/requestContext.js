import { AsyncLocalStorage } from 'async_hooks'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('@prisma/client').Usuario} Usuario */

/**
 * Estructura almacenada en AsyncLocalStorage para cada request.
 * @typedef {Object} RequestContextStore
 * @property {Request & { user?: Usuario }} req - La Request de Express para este ciclo de vida.
 */

/**
 * Instancia global de AsyncLocalStorage que mantiene un contexto
 * por cada request de Express.
 *
 * - Se inicializa en `contextMiddleware`.
 * - Permite recuperar la `req` (y su `req.user`) desde cualquier capa
 *   (servicios, repositorios, etc.) sin pasarla por parámetros.
 *
 * @type {AsyncLocalStorage<RequestContextStore>}
 */
export const requestContext = new AsyncLocalStorage()

/**
 * Middleware de contexto.
 *
 * Envuelve cada petición en un contexto aislado de `AsyncLocalStorage`.
 * Debe montarse **muy temprano** en el pipeline, antes de middlewares
 * y rutas que necesiten leer/escribir en `req`.
 *
 * Ejemplo de montaje:
 * ```js
 * import express from 'express'
 * import { contextMiddleware } from './middleware/requestContext.js'
 * import { authenticateJWT } from './middleware/authenticateJWT.js'
 *
 * const app = express()
 * app.use(express.json())
 * app.use(contextMiddleware)   // 1) abre el contexto
 * app.use(authenticateJWT)     // 2) setea req.user dentro del mismo contexto
 *
 * @param {Request} req - Request de Express.
 * @param {ExpressResponse} res - Response de Express.
 * @param {NextFunction} next - Siguiente middleware.
 * @returns {void}
 */
export function contextMiddleware(req, res, next) {
  requestContext.run({ req }, () => next())
}

/**
 * Obtiene el usuario autenticado desde el contexto de la petición.
 *
 * Requiere que:
 * - `contextMiddleware` haya envuelto la request (abre el contexto).
 * - Un middleware de autenticación (p. ej. `authenticateJWT`) haya
 *   colocado el objeto `Usuario` en `req.user`.
 *
 * @returns {Usuario} El usuario autenticado actual.
 * @throws {Error} Si no hay un usuario en el contexto de petición.
 *
 */
export function getCurrentUser() {
  const store = requestContext.getStore()
  if (!store || !store.req || !store.req.user) {
    throw new Error('No hay user en el contexto de petición')
  }
  return store.req.user
}
