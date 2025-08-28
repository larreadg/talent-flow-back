import jwt from 'jsonwebtoken'
import { Response } from '../utils/response.js'
import { prisma } from '../prismaClient.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('@prisma/client').Usuario} Usuario */

/**
 * Middleware de autenticación JWT.
 *
 * Extrae el token tipo **Bearer** del header `Authorization`, lo verifica usando
 * `process.env.JWT_SECRET`, y busca el usuario en base de datos por `username`
 * contenido en el payload del token. Si todo es válido, agrega el objeto `Usuario`
 * a `req.user` y continúa el pipeline; en caso contrario responde con **401**.
 *
 * **Requisitos:**
 * - Variable de entorno `JWT_SECRET` definida.
 *
 * **Efectos:**
 * - En éxito, define `req.user` con el objeto `Usuario` autenticado.
 * - En error (token inválido/expirado o usuario inexistente), responde `401` con
 *   un body estándar `Response`.
 *
 * @param {Request} req - Request de Express; se espera header `Authorization: Bearer <token>`.
 * @param {ExpressResponse} res - Response de Express; se usa para responder 401 en caso de error.
 * @param {NextFunction} next - Siguiente middleware en la cadena.
 * @returns {Promise<void>} No retorna valor; invoca `next()` en éxito o corta con 401.
 */
export async function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(new Response('error', 401, null, 'Token inválido o expirado'))
  }
  const token = auth.slice(7)
  try {
    /** @type {{ username: string } & Record<string, any>} */
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      id: payload.id,
      rol: payload.rol,
      empresaId: payload.empresaId
    }
    next()
  } catch {
    return res.status(401).json(new Response('error', 401, null, 'Token inválido o expirado'))
  }
}
