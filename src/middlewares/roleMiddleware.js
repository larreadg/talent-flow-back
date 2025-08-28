import { Response } from '../utils/response.js'
import { hasRol } from '../utils/utils.js'
import { getCurrentUser } from './requestContext.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('express').NextFunction} NextFunction */

/**
 * Middleware de autorización por rol.
 * Uso: router.get('/ruta', verifyRol(['TF_ADMIN', 'TF_LECTOR']), handler)
 *
 * Busca el usuario desde `req.user` (seteado por authenticateJWT)
 * o, si no existe, desde `getCurrentUser()` del requestContext.
 *
 * @param {string[]} allowedRoles
 * @returns {(req: Request, res: ExpressResponse, next: NextFunction) => void}
 */
export function verifyRol(allowedRoles = []) {
  return (req, res, next) => {
    /** @type {{ id: string, rol: string, empresaId: string }} */
    const user = /** @type any */ (req.user) ?? getCurrentUser?.()
    if (!hasRol(user, allowedRoles)) {
      return res.status(403).json(new Response('error', 403, null, 'No tiene permisos para esta acción'))
    }
    return next()
  }
}
