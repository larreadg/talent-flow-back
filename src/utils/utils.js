import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { TalentFlowError } from './error.js'

/** @typedef {import('@prisma/client').Usuario} Usuario */
/** @typedef {import('@prisma/client').Rol} Rol */

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 }

export const pick = (obj = {}, keys = []) => keys.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {})
export const appName = 'TalentFlow'

/**
 * Verificar si tiene un rol
 *
 * @param {{ id: string, rol: string, empresaId: string }} usuario
 * @param {string[]}  roles
 * @returns {boolean}
 */
export const hasRol = (usuario, roles) => {
    return roles.includes(usuario.rol) 
}

export const TF_SYS_ADMIN = ['TF_SYS_ADMIN']
export const TF_ADMINS = ['TF_SYS_ADMIN', 'ADMIN']
export const TF_ALL_ROLS = ['TF_SYS_ADMIN', 'ADMIN', 'LECTOR']

export const LOWERCASE_NUM_PRESET = 'abcdefghjkmnpqrstuvwxyz123456789'

/**
 * Valida la política de contraseña:
 * - Mínimo 8 caracteres
 * - Al menos 1 número
 * - Al menos 1 símbolo
 * @param {string} pass
 * @returns {string[]} array de errores (vacío si cumple)
 */
export function validatePasswordPolicy(pass) {
    const errs = []
    if (typeof pass !== 'string' || pass.length < 8) errs.push('La contraseña debe tener al menos 8 caracteres')
    if (!/[0-9]/.test(pass)) errs.push('La contraseña debe incluir al menos un número')
    if (!/[^\w\s]/.test(pass)) errs.push('La contraseña debe incluir al menos un símbolo')
    return errs
}
  
/**
 * Verifica un password contra el hash almacenado.
 * @param {string} stored
 * @param {string} plain
 * @returns {boolean}
 */
export function verifyPassword(stored, plain) {
    try {
      const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$')
      if (scheme !== 'scrypt') return false
      const salt = Buffer.from(saltHex, 'hex')
      const expected = Buffer.from(hashHex, 'hex')
      const got = scryptSync(plain, salt, expected.length, {
        N: Number(N),
        r: Number(r),
        p: Number(p),
      })
      return timingSafeEqual(expected, got)
    } catch {
      return false
    }
}

/**
 * Genera un hash scrypt con salt embebido.
 * Formato almacenado: scrypt$N$r$p$<hexSalt>$<hexHash>
 * @param {string} plain
 * @returns {string}
 */
export function hashPassword(plain) {
    if (!plain || typeof plain !== 'string') {
      throw new TalentFlowError('Password inválido', 400)
    }
    const salt = randomBytes(16)
    const buf = scryptSync(plain, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    })
    return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${buf.toString('hex')}`
}