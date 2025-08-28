import { prisma } from '../prismaClient.js'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { pick } from '../utils/utils.js'
import jwt from 'jsonwebtoken'
import { getCurrentUser } from '../middlewares/requestContext.js'
import dayjs from 'dayjs'
import { verifyCaptcha } from '../utils/captcha.js'

/** @typedef {import('@prisma/client').Usuario} Usuario */

/* =========================================
 * Password hashing helpers (scrypt + salt)
 * ========================================= */

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 }

/**
 * Genera un hash scrypt con salt embebido.
 * Formato almacenado: scrypt$N$r$p$<hexSalt>$<hexHash>
 * @param {string} plain
 * @returns {string}
 */
function hashPassword(plain) {
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

/**
 * Valida la política de contraseña:
 * - Mínimo 8 caracteres
 * - Al menos 1 número
 * - Al menos 1 símbolo
 * @param {string} pass
 * @returns {string[]} array de errores (vacío si cumple)
 */
function validatePasswordPolicy(pass) {
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
function verifyPassword(stored, plain) {
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

/* =========================================
 * DTO helpers
 * ========================================= */

const VISIBLE_USER_FIELDS = [
  'id',
  'email',
  'nombre',
  'apellido',
  'telefono',
  'activo',
  'empresa',
  'rol',
  'rolId'
]

/* =========================================
 * Servicios de autenticación
 * ========================================= */

/**
 * Login por username o email + password.
 * Retorna JWT firmado con roles y permisos del usuario.
 *
 * Payload del token:
 * {
 *   sub, username, email, empresaId,
 *   roles: [{ id, nombre }],
 *   permisos: [{ id, nombre, codigo }]
 * }
 *
 * @param {{ email: string, password: string, ip: string, captcha: string }} input
 * @returns {Promise<{ token: string, user: Pick<Usuario, typeof VISIBLE_USER_FIELDS[number]> }>}
 */
async function login({ email, password, ip, captcha }) {
  try {

    await verifyCaptcha({ ip, challenge: captcha })

    const user = await prisma.usuario.findFirst({
      where: { email },
      include: {
        empresa: { select: { nombre: true } }, // ← añadimos el nombre de la empresa
        rol: { select: { nombre: true } }
      },
    })

    if (!user || !user.password) {
      throw new TalentFlowError('Usuario o contraseña inválidos', 401)
    }
    if (!user.activo) {
      throw new TalentFlowError('Usuario inactivo', 401)
    }

    // Verificar password
    const ok = verifyPassword(user.password, password)
    if (!ok) {
      throw new TalentFlowError('Usuario o contraseña inválidos', 401)
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), um: user.id }
    })

    // Firmar JWT
    const secret = process.env.JWT_SECRET
    if (!secret) throw new TalentFlowError('JWT_SECRET no configurado', 500)

    const payload = {
      sub: user.id,
      id: user.id,
      username: user.username,
      email: user.email,
      empresaId: user.empresaId,
      rol: user.rol.nombre
    }

    const token = jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    })

    const safeUser = pick(user, VISIBLE_USER_FIELDS)
    return { token, user: safeUser }
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Auth' })
  }
}

/**
 * Actualiza la contraseña del usuario autenticado.
 *
 * Reglas:
 * - `pass` y `repeatPass` deben coincidir.
 * - Debe cumplir política (>=8, número, símbolo).
 * - No puede ser igual a la contraseña actual.
 * - Usuario debe estar activo.
 *
 * Efectos:
 * - Setea `password` (hash scrypt) y `um` con el usuario actual.
 *
 * @param {{ pass: string, repeatPass: string }} params
 * @returns {Promise<{ ok: true }>}
 * @throws {TalentFlowError} 401 si no autenticado; 403 si inactivo; 400 si política/confirmación falla.
 */
async function updatePass({ pass, repeatPass }) {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser?.id) throw new TalentFlowError('No autenticado', 401)

    // Confirmación
    if (!pass || !repeatPass || pass !== repeatPass) {
      throw new TalentFlowError('Las contraseñas no coinciden', 400)
    }

    // Política
    const policyErrors = validatePasswordPolicy(pass)
    if (policyErrors.length) {
      throw new TalentFlowError(policyErrors.join('. '), 400)
    }

    // Usuario
    const user = await prisma.usuario.findUnique({ where: { id: currentUser.id } })
    if (!user) throw new TalentFlowError('Usuario no encontrado', 404)
    if (!user.activo) throw new TalentFlowError('Usuario inactivo', 403)

    // Evitar reutilizar la misma contraseña
    if (user.password && verifyPassword(user.password, pass)) {
      throw new TalentFlowError('La nueva contraseña no puede ser igual a la anterior', 400)
    }

    // Hash + update
    const pw = hashPassword(pass)
    await prisma.usuario.update({
      where: { id: currentUser.id },
      data: { password: pw, um: currentUser.id },
    })

    return { ok: true }

  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

export const AuthService = {
  login,
  updatePass
}
