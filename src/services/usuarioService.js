// src/services/usuarioService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Usuario} Usuario */
/** @typedef {import('@prisma/client').Rol} Rol */
/** @typedef {import('@prisma/client').Equipo} Equipo */
/** @typedef {import('@prisma/client').UsuarioRol} UsuarioRol */
/** @typedef {import('@prisma/client').UsuarioEquipo} UsuarioEquipo */
/** @typedef {import('../utils/error.js').TalentFlowError} TalentFlowError */

/** Campos permitidos para actualizar Usuario */
const ALLOWED_FIELDS = [
  'empresaId',
  'departamentoId',
  'sedeId',
  'nombre',
  'apellido',
  'telefono',
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
      }),
      prisma.usuario.count({ where }),
    ])

    return {
      data,
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
 * Lista usuarios de un departamento con paginación, búsqueda y ordenamiento.
 *
 * @param {string} departamentoId - ID del departamento (UUID).
 * @param {Object} [params={}] Parámetros de consulta (page, pageSize, q, orderBy, order, activo, sedeId).
 * @returns {Promise<{data: Usuario[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {TalentFlowError}
 */
async function getByDepartamento(
  departamentoId,
  { page = 1, pageSize = 25, q, orderBy = 'username', order = 'asc', activo, sedeId } = {}
) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const where = {
      departamentoId,
      ...(typeof activo === 'boolean' ? { activo } : null),
      ...(sedeId ? { sedeId } : null),
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
      }),
      prisma.usuario.count({ where }),
    ])

    return {
      data,
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
 * Agrega y/o quita **roles** a un usuario.
 * Usa la tabla de unión `Usuario_Rol` (modelo Prisma: UsuarioRol).
 *
 * Reglas:
 * - `add`: array de objetos con `{ rolId, scopeSedeId?, scopeDepartamentoId?, scopeEquipoId?, validFrom?, validTo? }`
 * - `remove`: array que puede ser:
 *    - string[] → IDs de `rolId` (elimina todas las filas de ese rol para el usuario)
 *    - objetos `{ rolId, scopeSedeId?, scopeDepartamentoId?, scopeEquipoId? }` para borrar selectivo por scope
 *
 * @param {string} usuarioId - ID del usuario (UUID).
 * @param {{ add?: Array<{rolId: string, scopeSedeId?: string, scopeDepartamentoId?: string, scopeEquipoId?: string, validFrom?: Date|string, validTo?: Date|string}>, remove?: Array<string|{rolId: string, scopeSedeId?: string, scopeDepartamentoId?: string, scopeEquipoId?: string}> }} payload
 * @returns {Promise<{ added: number, removed: number, roles: (UsuarioRol & { rol: Rol })[] }>}
 * @throws {TalentFlowError}
 */
async function patchRoles(usuarioId, { add = [], remove = [] } = {}) {
  try {
    const currentUser = getCurrentUser()

    const tx = []

    // ADD
    if (Array.isArray(add) && add.length) {
      tx.push(
        prisma.usuarioRol.createMany({
          data: add.map((r) => ({
            usuarioId,
            rolId: r.rolId,
            scopeSedeId: r.scopeSedeId ?? null,
            scopeDepartamentoId: r.scopeDepartamentoId ?? null,
            scopeEquipoId: r.scopeEquipoId ?? null,
            validFrom: r.validFrom ?? null,
            validTo: r.validTo ?? null,
            uc: currentUser.id,
            um: currentUser.id,
          })),
          skipDuplicates: true,
        })
      )
    } else {
      tx.push(Promise.resolve({ count: 0 }))
    }

    // REMOVE
    if (Array.isArray(remove) && remove.length) {
      const deleteOR = remove.map((item) => {
        if (typeof item === 'string') {
          // elimina TODAS las asignaciones del rol indicado
          return { AND: [{ usuarioId }, { rolId: item }] }
        }
        // elimina por combinación específica de rol + scopes provistos
        const cond = [{ usuarioId }, { rolId: item.rolId }]
        if (item.scopeSedeId !== undefined) cond.push({ scopeSedeId: item.scopeSedeId })
        if (item.scopeDepartamentoId !== undefined) cond.push({ scopeDepartamentoId: item.scopeDepartamentoId })
        if (item.scopeEquipoId !== undefined) cond.push({ scopeEquipoId: item.scopeEquipoId })
        return { AND: cond }
      })

      tx.push(prisma.usuarioRol.deleteMany({ where: { OR: deleteOR } }))
    } else {
      tx.push(Promise.resolve({ count: 0 }))
    }

    const [createRes, deleteRes] = await prisma.$transaction(tx)

    // Lista actual de roles del usuario (con el rol incluido)
    const roles = await prisma.usuarioRol.findMany({
      where: { usuarioId },
      include: { rol: true },
      orderBy: [{ rol: { nombre: 'asc' } }],
    })

    return { added: createRes?.count ?? 0, removed: deleteRes?.count ?? 0, roles }
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Usuario' })
  }
}

/**
 * Agrega y/o quita **equipos** a un usuario.
 * Usa la tabla de unión `Usuario_Equipo` (modelo Prisma: UsuarioEquipo).
 *
 * Reglas:
 * - `add`: array de objetos `{ equipoId, rolEnEquipo?, validFrom?, validTo? }`
 * - `remove`: array de `equipoId` (string) a desvincular
 *
 * @param {string} usuarioId - ID del usuario (UUID).
 * @param {{ add?: Array<{equipoId: string, rolEnEquipo?: string, validFrom?: Date|string, validTo?: Date|string}>, remove?: string[] }} payload
 * @returns {Promise<{ added: number, removed: number, equipos: (UsuarioEquipo & { equipo: Equipo })[] }>}
 * @throws {TalentFlowError}
 */
async function patchEquipos(usuarioId, { add = [], remove = [] } = {}) {
  try {
    const currentUser = getCurrentUser()

    const tx = []

    // ADD
    if (Array.isArray(add) && add.length) {
      tx.push(
        prisma.usuarioEquipo.createMany({
          data: add.map((e) => ({
            usuarioId,
            equipoId: e.equipoId,
            rolEnEquipo: e.rolEnEquipo ?? null,
            validFrom: e.validFrom ?? null,
            validTo: e.validTo ?? null,
            uc: currentUser.id,
            um: currentUser.id,
          })),
          skipDuplicates: true,
        })
      )
    } else {
      tx.push(Promise.resolve({ count: 0 }))
    }

    // REMOVE
    if (Array.isArray(remove) && remove.length) {
      tx.push(prisma.usuarioEquipo.deleteMany({ where: { usuarioId, equipoId: { in: remove } } }))
    } else {
      tx.push(Promise.resolve({ count: 0 }))
    }

    const [createRes, deleteRes] = await prisma.$transaction(tx)

    // Lista actual de equipos del usuario (con información del equipo)
    const equipos = await prisma.usuarioEquipo.findMany({
      where: { usuarioId },
      include: { equipo: true },
      orderBy: [{ equipo: { nombre: 'asc' } }],
    })

    return { added: createRes?.count ?? 0, removed: deleteRes?.count ?? 0, equipos }
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

export const UsuarioService = {
  getByEmpresa,
  getByDepartamento,
  getById,
  patchRoles,
  patchEquipos,
  patch,
  delete: remove,
  remove,
}
