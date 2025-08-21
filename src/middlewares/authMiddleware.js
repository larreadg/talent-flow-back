import jwt from 'jsonwebtoken'
import { Response } from '../utils/response.js'
import { prisma } from '../prismaClient.js'

/**
 * Middleware de autenticación: verifica el JWT y pone el payload en req.user
 */
export async function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(new Response('error', 401, null, 'Token inválido o expirado'))
  }
  const token = auth.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.usuario.findFirst({ where: { usuario: payload.usuario } })
    if(!user) return res.status(401).json(new Response('error', 401, null, 'Token inválido o expirado'))
    req.user = user
    next()
  } catch {
    return res.status(401).json(new Response('error', 401, null, 'Token inválido o expirado'))
  }
}