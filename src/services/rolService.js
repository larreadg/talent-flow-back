// src/services/rolService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Rol} Rol */
/** @typedef {import('@prisma/client').Permiso} Permiso */

/** Campos permitidos para crear/actualizar Rol */
const ALLOWED_FIELDS = ['empresaId', 'nombre', 'descripcion']

/**
 * Lista roles de una empresa con paginación, búsqueda y ordenamiento.
 *
 * @param {string} empresaId - ID de la empresa (UUID).
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `nombre` o `descripcion`.
 * @param {'nombre'|'fc'|'fm'} [params.orderBy='nombre'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @returns {Promise<{data: Rol[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Resultado paginado con los roles y metadatos de paginación.
 * @throws {import('../utils/error.js').TalentFlowError}
 */
async function getByEmpresa(empresaId, { page = 1, pageSize = 25, q, orderBy = 'nombre', order = 'asc' } = {}) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const where = {
      empresaId,
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { descripcion: { contains: q, mode: 'insensitive' } },
            ],
          }
        : null),
    }

    const safeOrder = ['nombre', 'fc', 'fm'].includes(orderBy) ? orderBy : 'nombre'
    const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const [data, total] = await Promise.all([
      prisma.rol.findMany({
        where,
        orderBy: { [safeOrder]: direction },
        skip,
        take,
      }),
      prisma.rol.count({ where }),
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
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

/**
 * Obtiene un rol por su ID (UUID).
 *
 * @param {string} id - ID del rol.
 * @returns {Promise<Rol>} El rol encontrado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe.
 */
async function getById(id) {
  try {
    const item = await prisma.rol.findUnique({ where: { id } })
    if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'Rol' })
    return item
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

/**
 * Crea un nuevo rol (scoped por empresa).
 * Auditoría: `uc` y `um` se setean con el usuario actual vía `getCurrentUser()`.
 * Sin validaciones de negocio aquí (van en controllers).
 *
 * @param {Partial<Rol>} [input={}] - Datos a persistir.
 * @returns {Promise<Rol>} El rol creado.
 * @throws {import('../utils/error.js').TalentFlowError} 409 si viola unicidad; otros errores de base.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.uc = currentUser.id
    data.um = currentUser.id

    const created = await prisma.rol.create({ data })
    return created
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

/**
 * Actualiza parcialmente un rol existente.
 * Sólo considera `empresaId`, `nombre`, `descripcion`.
 * Auditoría: setea `um` con el usuario actual.
 *
 * @param {string} id - ID del rol.
 * @param {Partial<Rol>} [input={}] - Campos a actualizar.
 * @returns {Promise<Rol>} El rol actualizado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    const updated = await prisma.rol.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

/**
 * Agrega y/o quita permisos a un rol.
 * Usa la tabla de unión explícita `Rol_Permiso`.
 *
 * **Reglas:**
 * - `add`: array de IDs de permisos a **agregar** (crea filas en `Rol_Permiso`).
 * - `remove`: array de IDs de permisos a **quitar** (deleteMany en `Rol_Permiso`).
 * - Emplea `createMany({ skipDuplicates: true })` para evitar P2002.
 * - Devuelve conteos de agregados y removidos, más la lista actual de permisos del rol.
 *
 * @param {string} rolId - ID del rol.
 * @param {{ add?: string[], remove?: string[] }} payload - Instrucciones de modificación.
 * @returns {Promise<{ added: number, removed: number, permisos: Permiso[] }>}
 * Conteo de cambios y permisos actuales del rol.
 * @throws {import('../utils/error.js').TalentFlowError}
 */
async function patchPermisos(rolId, { add = [], remove = [] } = {}) {
  try {
    const currentUser = getCurrentUser()

    // Operaciones en transacción: crear y borrar vínculos
    const ops = []
    if (Array.isArray(add) && add.length) {
      ops.push(
        prisma.rolPermiso.createMany({
          data: add.map((permisoId) => ({
            rolId,
            permisoId,
            uc: currentUser.id,
            um: currentUser.id,
          })),
          skipDuplicates: true,
        })
      )
    } else {
      ops.push(Promise.resolve({ count: 0 }))
    }

    if (Array.isArray(remove) && remove.length) {
      ops.push(
        prisma.rolPermiso.deleteMany({
          where: { rolId, permisoId: { in: remove } },
        })
      )
    } else {
      ops.push(Promise.resolve({ count: 0 }))
    }

    const [createRes, deleteRes] = await prisma.$transaction(ops)

    // Recuperar permisos actuales del rol (proyección directa de Permiso)
    const permisos = await prisma.permiso.findMany({
      where: { roles: { some: { rolId } } },
      orderBy: { clave: 'asc' },
    })

    return {
      added: createRes?.count ?? 0,
      removed: deleteRes?.count ?? 0,
      permisos,
    }
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

/**
 * Elimina un rol por ID.
 *
 * @param {string} id - ID del rol.
 * @returns {Promise<Rol>} El registro eliminado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si tiene relaciones que impiden borrar; otros errores de base.
 */
async function remove(id) {
  try {
    const deleted = await prisma.rol.delete({ where: { id } })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

export const RolService = {
  getByEmpresa,
  getById,
  post,
  patch,
  patchPermisos,
  delete: remove,
  remove,
}
