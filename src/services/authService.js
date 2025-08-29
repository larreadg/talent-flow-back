import { prisma } from '../prismaClient.js'

import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { appName, pick, validatePasswordPolicy, verifyPassword } from '../utils/utils.js'
import { verifyCaptcha } from '../utils/captcha.js'
import { readFile } from 'node:fs/promises'
import jwt from 'jsonwebtoken'
import dayjs from 'dayjs'
import { enviarCorreo } from './emailService.js'

/** @typedef {import('@prisma/client').Usuario} Usuario */

/**
 * Verifica un token válido y NO vencido y lo CONSUME (borra).
 * Operación atómica (transacción) para evitar reuso/race conditions.
 *
 * @param {{ token: string, tipo: 'activate_account' | 'update_pass' }} input
 * @returns {Promise<{ usuarioId: string }>}
 * @throws {TalentFlowError} 400 si inválido o vencido
 */
export async function verifyAndConsumeUsuarioToken({ token, tipo }) {
  try {
    const now = new Date()

    return await prisma.$transaction(async (tx) => {
      // 1) Buscar el token vigente y obtener usuarioId
      console.log(token)
      const rec = await tx.usuarioToken.findFirst({
        where: { id: token, tipo, expiresAt: { gte: now } },
        select: { id: true, usuarioId: true },
      })
      if (!rec) {
        throw new TalentFlowError('Token inválido o vencido', 400)
      }

      // 2) Consumir (one-time): borrar ese token
      const { count } = await tx.usuarioToken.deleteMany({
        where: { id: rec.id, tipo },
      })
      if (count === 0) {
        // otro proceso lo consumió entre (1) y (2)
        throw new TalentFlowError('Token inválido o vencido', 400)
      }

      return { usuarioId: rec.usuarioId }
    })
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'UsuarioToken' })
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
 * Activa un usuario y setea su password
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
 * @param {{ pass: string, repeatPass: string, captcha: string, token: string, ip: string }} params
 * @returns {Promise<{ ok: true }>}
 * @throws {TalentFlowError} 401 si no autenticado; 403 si inactivo; 400 si política/confirmación falla.
 */
async function activateAccount({ pass, repeatPass, captcha, token, ip }) {
  try {
    
    // Confirmación
    if (!pass || !repeatPass || pass !== repeatPass) {
      throw new TalentFlowError('Las contraseñas no coinciden', 400)
    }

    // Política
    const policyErrors = validatePasswordPolicy(pass)
    if (policyErrors.length) {
      throw new TalentFlowError(policyErrors.join('. '), 400)
    }
    
    await verifyCaptcha({ ip, challenge: captcha, from: 'activate_account' })

    const { usuarioId } = await verifyAndConsumeUsuarioToken({ token, tipo: 'activate_account' })

    // Hash + update
    const pw = hashPassword(pass)
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { password: pw, um: usuarioId, activo: true },
    })

    return { ok: true }

  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Envia un correo para restablecer contraseña
 *
 * @param {{ email: string, captcha: string, ip: string }} params
 * @returns {Promise<{ ok: true }>}
 * @throws {TalentFlowError} 401 si no autenticado; 403 si inactivo; 400 si política/confirmación falla.
 */
async function resetAccountRequest({ email, captcha, ip }) {
  try {
    
    const ttlUnit = 'minute'
    const ttl = 30

    await verifyCaptcha({ ip, challenge: captcha, from: 'update_pass' })

    const user = await prisma.usuario.findFirst({ where: { email } })

    if(!user) {
      throw new TalentFlowError('Ha ocurrido un error al reestablecer la cuenta', 400)
    }

    const token = await prisma.usuarioToken.create({
      data: {
        usuarioId: user.id,
        tipo: 'update_pass',
        expiresAt: dayjs().add(ttl, ttlUnit).toDate()
      }
    })

    const fileUrl = new URL('../resources/templateEmailRestablecerCuenta.html', import.meta.url)
    let emailTemplate = await readFile(fileUrl, 'utf8')
    emailTemplate = emailTemplate.replace(/\$nombre/g, user.nombre)
    emailTemplate = emailTemplate.replace(/\$apellido/g, user.apellido)
    emailTemplate = emailTemplate.replace(/\$reset_url/g, `${process.env.APP_FROM}/#/auth/reset-account?token=${token.id}`)

    await enviarCorreo({ to: user.email, html: emailTemplate, subject: `${appName} - Restablecer cuenta` })

  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Reestablece una cuenta
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
 * @param {{ pass: string, repeatPass: string, captcha: string, token: string, ip: string }} params
 * @returns {Promise<{ ok: true }>}
 * @throws {TalentFlowError} 401 si no autenticado; 403 si inactivo; 400 si política/confirmación falla.
 */
async function resetAccount({ pass, repeatPass, captcha, token, ip }) {
  try {
    
    // Confirmación
    if (!pass || !repeatPass || pass !== repeatPass) {
      throw new TalentFlowError('Las contraseñas no coinciden', 400)
    }

    // Política
    const policyErrors = validatePasswordPolicy(pass)
    if (policyErrors.length) {
      throw new TalentFlowError(policyErrors.join('. '), 400)
    }
    
    await verifyCaptcha({ ip, challenge: captcha, from: 'update_pass' })

    const { usuarioId } = await verifyAndConsumeUsuarioToken({ token, tipo: 'update_pass' })

    // Hash + update
    const pw = hashPassword(pass)
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { password: pw, um: usuarioId },
    })

    return { ok: true }

  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

export const AuthService = {
  login,
  activateAccount,
  resetAccountRequest,
  resetAccount,
}
