import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { pick } from '../utils/utils.js'
import jwt from 'jsonwebtoken'

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
  'empresaId',
  'departamentoId',
  'sedeId',
  'username',
  'email',
  'nombre',
  'apellido',
  'telefono',
  'activo',
  'fc',
  'fm',
]

/* =========================================
 * Servicios de autenticación
 * ========================================= */

/**
 * Crea un usuario con password hasheado.
 * Requiere: empresaId, username, email, password, nombre, apellido, telefono
 * Opcionales: departamentoId, sedeId
 * Auditoría: uc/um se setean con `getCurrentUser()` si existe.
 *
 * @param {Partial<Usuario> & { password: string }} input
 * @returns {Promise<Pick<Usuario, typeof VISIBLE_USER_FIELDS[number]>>}
 */
async function registerUsuario(input) {
  try {
    const required = ['empresaId', 'username', 'email', 'password', 'nombre', 'apellido', 'telefono']
    for (const k of required) {
      if (!input?.[k]) {
        throw new TalentFlowError(`Falta el campo requerido: ${k}`, 400)
      }
    }

    const current = (() => {
      try {
        return getCurrentUser()
      } catch {
        return null
      }
    })()

    const hashed = hashPassword(input.password)

    const created = await prisma.usuario.create({
      data: {
        empresaId: input.empresaId,
        departamentoId: input.departamentoId ?? null,
        sedeId: input.sedeId ?? null,
        username: input.username,
        email: input.email,
        password: hashed,
        nombre: input.nombre,
        apellido: input.apellido,
        telefono: input.telefono,
        activo: true,
        uc: current?.id ?? 'system',
        um: current?.id ?? 'system',
      },
    })

    return pick(created, VISIBLE_USER_FIELDS)
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

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
 * @param {{ username?: string, email?: string, password: string }} input
 * @returns {Promise<{ token: string, user: Pick<Usuario, typeof VISIBLE_USER_FIELDS[number]> }>}
 */
async function login(input) {
  try {
    const { username, email, password } = input || {}
    if ((!username && !email) || !password) {
      throw new TalentFlowError('Credenciales incompletas', 400)
    }

    // Buscar por username o email
    const user = await prisma.usuario.findFirst({
      where: {
        OR: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    })

    if (!user || !user.password) {
      throw new TalentFlowError('Usuario o contraseña inválidos', 401)
    }
    if (!user.activo) {
      throw new TalentFlowError('Usuario inactivo', 403)
    }

    // Verificar password
    const ok = verifyPassword(user.password, password)
    if (!ok) {
      throw new TalentFlowError('Usuario o contraseña inválidos', 401)
    }

    // Roles del usuario (con nombre)
    const usuarioRoles = await prisma.usuarioRol.findMany({
      where: { usuarioId: user.id },
      include: { rol: true },
      orderBy: [{ rol: { nombre: 'asc' } }],
    })
    const roles = usuarioRoles
      .filter(ur => !!ur.rol)
      .map(ur => ({ id: ur.rol.id, nombre: ur.rol.nombre }))

    // Permisos por roles
    const rolIds = [...new Set(usuarioRoles.map(ur => ur.rolId))]
    let permisos = []
    if (rolIds.length) {
      const rolPermisos = await prisma.rolPermiso.findMany({
        where: { rolId: { in: rolIds } },
        include: { permiso: true },
      })
      // Deduplicar por id
      const seen = new Set()
      for (const rp of rolPermisos) {
        const p = rp.permiso
        if (p && !seen.has(p.id)) {
          seen.add(p.id)
          permisos.push({ id: p.id, clave: p.clave, descripcion: p.descripcion })
        }
      }
    }

    // Firmar JWT
    const secret = process.env.JWT_SECRET
    if (!secret) throw new TalentFlowError('JWT_SECRET no configurado', 500)

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      empresaId: user.empresaId,
      roles,
      permisos,
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

export const AuthService = {
  registerUsuario,
  login,
}
