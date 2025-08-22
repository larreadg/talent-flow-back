import { prisma } from '../prismaClient.js'
import { mapPrismaError } from '../utils/error.js'

/** @typedef {import('@prisma/client').Permiso} Permiso */

/**
 * Lista permisos con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `clave`, `recurso` o `accion`.
 * @param {'clave'|'recurso'|'accion'|'fc'|'fm'} [params.orderBy='clave'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @returns {Promise<{data: Permiso[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Resultado paginado con el arreglo de permisos y metadatos de paginación.
 * @throws {import('../utils/error.js').TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getAll({ page = 1, pageSize = 25, q, orderBy = 'clave', order = 'asc' } = {}) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const where =
      q
        ? {
            OR: [
              { clave:   { contains: q, mode: 'insensitive' } },
              { recurso: { contains: q, mode: 'insensitive' } },
              { accion:  { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined

    const safeOrder = ['clave', 'recurso', 'accion', 'fc', 'fm'].includes(orderBy) ? orderBy : 'clave'
    const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const [data, total] = await Promise.all([
      prisma.permiso.findMany({
        where,
        orderBy: { [safeOrder]: direction },
        skip,
        take,
      }),
      prisma.permiso.count({ where }),
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
    throw mapPrismaError(e, { resource: 'Permiso' })
  }
}

/**
 * Obtiene un permiso por su ID (UUID).
 *
 * @param {string} id - ID del permiso.
 * @returns {Promise<Permiso>} El permiso encontrado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe el permiso.
 */
async function getById(id) {
  try {
    const item = await prisma.permiso.findUnique({ where: { id } })
    if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'Permiso' })
    return item
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Permiso' })
  }
}

/**
 * Lista permisos asociados a un rol específico (via tabla Rol_Permiso).
 * No falla si el rol no existe o no tiene permisos; devuelve lista vacía.
 *
 * @param {string} rolId - ID del rol.
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `clave`, `recurso` o `accion`.
 * @param {'clave'|'recurso'|'accion'|'fc'|'fm'} [params.orderBy='clave'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @returns {Promise<{data: Permiso[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Permisos del rol con paginación y metadatos.
 * @throws {import('../utils/error.js').TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getByRol(rolId, { page = 1, pageSize = 25, q, orderBy = 'clave', order = 'asc' } = {}) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const baseWhere = {
      roles: { some: { rolId } }, // relación con Rol_Permiso
    }

    const searchWhere =
      q
        ? {
            OR: [
              { clave:   { contains: q, mode: 'insensitive' } },
              { recurso: { contains: q, mode: 'insensitive' } },
              { accion:  { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined

    const where = searchWhere ? { AND: [baseWhere, searchWhere] } : baseWhere

    const safeOrder = ['clave', 'recurso', 'accion', 'fc', 'fm'].includes(orderBy) ? orderBy : 'clave'
    const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const [data, total] = await Promise.all([
      prisma.permiso.findMany({
        where,
        orderBy: { [safeOrder]: direction },
        skip,
        take,
      }),
      prisma.permiso.count({ where }),
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
    throw mapPrismaError(e, { resource: 'Permiso' })
  }
}

export const PermisoService = {
  getAll,
  getById,
  getByRol,
}
