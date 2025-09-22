// src/services/usuarioService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { appName, hashPassword, pick, validatePasswordPolicy, verifyPassword } from '../utils/utils.js'
import { enviarCorreo } from './emailService.js'
import { readFile } from 'node:fs/promises'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
dayjs.extend(utc)
dayjs.extend(timezone)

/** @typedef {import('@prisma/client').Usuario} Usuario */
/** @typedef {import('@prisma/client').Rol} Rol */
/** @typedef {import('@prisma/client').Equipo} Equipo */
/** @typedef {import('@prisma/client').UsuarioRol} UsuarioRol */
/** @typedef {import('@prisma/client').UsuarioEquipo} UsuarioEquipo */
/** @typedef {import('../utils/error.js').TalentFlowError} TalentFlowError */

/** Campos permitidos para actualizar Usuario */
const ALLOWED_FIELDS = [
  'nombre',
  'apellido',
  'telefono',
  'rolId',
  'activo'
]

/**
 * Lista usuarios de una empresa con paginación, búsqueda y ordenamiento.
 *
 * @param {string} empresaId - ID de la empresa (UUID).
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `username`, `email`, `nombre`, `apellido`, `telefono`.
 * @param {'username'|'email'|'nombre'|'apellido'|'fc'|'fm'} [params.orderBy='username'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @param {boolean} [params.activo] Filtra por estado activo/inactivo.
 * @param {string} [params.sedeId] Filtra por sede (UUID).
 * @param {string} [params.departamentoId] Filtra por departamento (UUID).
 * @returns {Promise<{data: Usuario[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {TalentFlowError}
 */
async function getByEmpresa(
  empresaId,
  { page = 1, pageSize = 25, q, orderBy = 'username', order = 'asc', activo, sedeId, departamentoId } = {}
) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const where = {
      empresaId,
      ...(typeof activo === 'boolean' ? { activo } : null),
      ...(sedeId ? { sedeId } : null),
      ...(departamentoId ? { departamentoId } : null),
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { nombre: { contains: q, mode: 'insensitive' } },
              { apellido: { contains: q, mode: 'insensitive' } },
              { telefono: { contains: q, mode: 'insensitive' } },
            ],
          }
        : null),
    }

    const safeOrder = ['username', 'email', 'nombre', 'apellido', 'fc', 'fm'].includes(orderBy) ? orderBy : 'username'
    const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const [data, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        orderBy: { [safeOrder]: direction },
        skip,
        take,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          activo: true,
          lastLogin: true,
          telefono: true,
          rol: { select: { nombre: true } },
          empresa: { select: { nombre: true } },
          rolId: true,
          empresaId: true
        }
      }),
      prisma.usuario.count({ where }),
    ])

    const dataFormatted = data.map(u => ({
      ...u,
      lastLogin: u.lastLogin
        ? dayjs(u.lastLogin).tz(process.env.APP_TZ).format('YYYY-MM-DD HH:mm:ss')
        : null,
    }))

    return {
      data: dataFormatted,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    }
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Obtiene un usuario por su ID (UUID).
 *
 * @param {string} id - ID del usuario.
 * @returns {Promise<Usuario>} El usuario encontrado.
 * @throws {TalentFlowError} 404 si no existe.
 */
async function getById(id) {
  try {
    const item = await prisma.usuario.findUnique({ where: { id } })
    if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'Usuario' })
    return item
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Actualiza parcialmente un usuario.
 * Considera: `empresaId`, `departamentoId`, `sedeId`, `username`, `email`, `nombre`, `apellido`, `telefono`, `activo`.
 * Auditoría: setea `um` con el usuario actual.
 *
 * @param {string} id - ID del usuario.
 * @param {Partial<Usuario>} [input={}] - Campos a actualizar.
 * @returns {Promise<Usuario>} El usuario actualizado.
 * @throws {TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    const updated = await prisma.usuario.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * "Elimina" un usuario (soft delete): marca `activo = false`.
 * Actualiza `um` con el usuario actual.
 *
 * @param {string} id - ID del usuario.
 * @returns {Promise<Usuario>} El usuario actualizado (inactivo).
 * @throws {TalentFlowError} 404 si no existe; otros errores de base.
 */
async function remove(id) {
  try {
    const currentUser = getCurrentUser()
    const updated = await prisma.usuario.update({
      where: { id },
      data: { activo: false, um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Lista usuarios de la **empresa del usuario autenticado** con paginación, búsqueda y ordenamiento.
 *
 * No recibe `empresaId` porque se obtiene de `getCurrentUser()`.
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=25]
 * @param {string} [params.q] Busca en username, email, nombre, apellido, telefono
 * @param {'username'|'email'|'nombre'|'apellido'|'fc'|'fm'} [params.orderBy='username']
 * @param {'asc'|'desc'} [params.order='asc']
 * @param {boolean} [params.activo]
 * @param {string} [params.sedeId]
 * @param {string} [params.departamentoId]
 * @returns {Promise<{data: Usuario[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {TalentFlowError} 401 si no hay usuario en contexto; 403 si no tiene empresa asociada.
 */
async function get(params = {}) {
  try {
    const currentUser = getCurrentUser()
    return await getByEmpresa(currentUser.empresaId, params)
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Guardar un usuario
 *
 * @param {Object} input
 * @param {string} input.email
 * @param {string} input.nombre
 * @param {string} input.apellido
 * @param {string} input.telefono
 * @param {string} input.rolId
 * @param {string} [input.empresaId]
 * @returns {Promise<Partial<Usuario>>}
 * @throws {TalentFlowError} 401 si no hay usuario en contexto; 403 si no tiene empresa asociada.
 */
async function post({ email, nombre, apellido, telefono, rolId, empresaId }) {
  try {
    // Token de activacion
    const ttlUnit = 'day'
    const ttl = 1

    const currentUser = getCurrentUser()
    const created = await prisma.usuario.create({
      data: {
        empresaId: empresaId || currentUser.empresaId,
        departamentoId: null,
        sedeId: null,
        username: email,
        email: email,
        password: 'unset',
        nombre: nombre,
        apellido: apellido,
        telefono: telefono,
        activo: false,
        uc: currentUser.id,
        um: currentUser.id,
        rolId
      },
    })

    const token = await prisma.usuarioToken.create({
      data: {
        usuarioId: created.id,
        tipo: 'activate_account',
        expiresAt: dayjs().add(ttl, ttlUnit).toDate()
      }
    })

    // const fileUrl = new URL('../resources/templateEmailCrearCuenta.html', import.meta.url)
    // let emailTemplate = await readFile(fileUrl, 'utf8')
    // emailTemplate = emailTemplate.replace(/\$nombre/g, created.nombre)
    // emailTemplate = emailTemplate.replace(/\$apellido/g, created.apellido)
    // emailTemplate = emailTemplate.replace(/\$activation_url/g, `${process.env.APP_FROM}/#/auth/activate-account?token=${token.id}`)

    // await enviarCorreo({ to: created.email, html: emailTemplate, subject: `${appName} - Activación de cuenta` })

  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
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

export const UsuarioService = {
  get,
  getById,
  patch,
  delete: remove,
  remove,
  post,
  updatePass
}
