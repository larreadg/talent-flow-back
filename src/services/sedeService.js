// src/services/sedeService.js
import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Sede} Sede */

const ALLOWED_FIELDS = [
  'empresaId',
  'nombre',
  'codigo',
  'direccion',
  'ciudad',
  'region',
  'pais',
  'timezone',
]

/**
 * Lista sedes con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `nombre`, `codigo`, `ciudad`, `region`, `pais`.
 * @param {'nombre'|'ciudad'|'region'|'pais'|'fc'|'fm'} [params.orderBy='nombre'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @param {string} [params.empresaId] (opcional) Filtra por empresa.
 * @returns {Promise<{data: Sede[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Resultado paginado con el arreglo de sedes y metadatos de paginación.
 * @throws {TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getAll({ page = 1, pageSize = 25, q, orderBy = 'nombre', order = 'asc', empresaId } = {}) {
  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const take = Math.max(1, Number(pageSize))

  const where = {
    ...(empresaId ? { empresaId } : null),
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { codigo: { contains: q, mode: 'insensitive' } },
            { ciudad: { contains: q, mode: 'insensitive' } },
            { region: { contains: q, mode: 'insensitive' } },
            { pais: { contains: q, mode: 'insensitive' } },
          ],
        }
      : null),
  }

  const safeOrder = ['nombre', 'ciudad', 'region', 'pais', 'fc', 'fm'].includes(orderBy) ? orderBy : 'nombre'
  const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

  const [data, total] = await Promise.all([
    prisma.sede.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { [safeOrder]: direction },
      skip,
      take,
    }),
    prisma.sede.count({ where: Object.keys(where).length ? where : undefined }),
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
}

/**
 * Obtiene una sede por su ID (UUID).
 *
 * @param {string} id - ID de la sede.
 * @returns {Promise<Sede>} La sede encontrada.
 * @throws {TalentFlowError} 404 si no existe la sede.
 */
async function getById(id) {
  const item = await prisma.sede.findUnique({ where: { id } })
  if (!item) throw new TalentFlowError('Sede no encontrada.', 404)
  return item
}

/**
 * Lista sedes de una empresa con paginación/búsqueda/ordenamiento.
 *
 * @param {string} empresaId - ID de la empresa.
 * @param {Object} [params={}] Parámetros de consulta (page, pageSize, q, orderBy, order).
 * @returns {Promise<{data: Sede[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getByEmpresa(empresaId, params = {}) {
  return getAll({ ...params, empresaId })
}

/**
 * Crea una nueva sede.
 * Toma `uc` y `um` del usuario actual vía `getCurrentUser()`.
 * No realiza validaciones de negocio (eso se hace en controllers).
 *
 * @param {Partial<Sede>} [input={}] - Datos a persistir.
 * @returns {Promise<Sede>} La sede creada.
 * @throws {TalentFlowError} 409 si viola una restricción de unicidad; otros errores de base.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    // Auditoría
    data.uc = currentUser.id
    data.um = currentUser.id

    const created = await prisma.sede.create({ data })
    return created
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Sede' })
  }
}

/**
 * Actualiza parcialmente una sede existente.
 * Sólo se consideran los campos permitidos (`empresaId`, `nombre`, `codigo`, `direccion`, `ciudad`, `region`, `pais`, `timezone`).
 * Setea `um` con el usuario actual vía `getCurrentUser()`.
 *
 * @param {string} id - ID de la sede.
 * @param {Partial<Sede>} [input={}] - Campos a actualizar.
 * @returns {Promise<Sede>} La sede actualizada.
 * @throws {TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    const updated = await prisma.sede.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Sede' })
  }
}

/**
 * Elimina una sede por ID.
 *
 * @param {string} id - ID de la sede.
 * @returns {Promise<Sede>} El registro eliminado.
 * @throws {TalentFlowError} 404 si no existe; 409 si tiene relaciones que impiden borrar; otros errores de base.
 */
async function remove(id) {
  try {
    const deleted = await prisma.sede.delete({ where: { id } })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Sede' })
  }
}

export const SedeService = {
  getAll,
  getById,
  getByEmpresa,
  post,
  patch,
  delete: remove,
  remove,
}
