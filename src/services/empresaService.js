import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { hasRol, pick, TF_SYS_ADMIN } from '../utils/utils.js'

// Campos permitidos para create/update
const ALLOWED_FIELDS = ['nombre', 'razonSocial', 'ruc']

/** @typedef {import('@prisma/client').Empresa} Empresa */
/** @typedef {import('../utils/error.js').TalentFlowError} TalentFlowError */

/**
 * Lista empresas con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `nombre`, `razonSocial` o `ruc`.
 * @param {'nombre'|'razonSocial'|'ruc'|'fc'|'fm'} [params.orderBy='nombre'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @returns {Promise<{data: Empresa[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Resultado paginado con el arreglo de empresas y metadatos de paginación.
 * @throws {TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getAll({ page = 1, pageSize = 25, q, orderBy = 'nombre', order = 'asc' } = {}) {
  
  const currentUser = getCurrentUser()
  if(!hasRol(currentUser, TF_SYS_ADMIN)) {
    throw new TalentFlowError(`No tiene permisos para esta acción`, 403)
  }

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const take = Math.max(1, Number(pageSize))

  const where = q
    ? {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { razonSocial: { contains: q, mode: 'insensitive' } },
          { ruc: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined

  const safeOrder = ['nombre', 'razonSocial', 'ruc', 'fc', 'fm'].includes(orderBy) ? orderBy : 'nombre'
  const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

  const [data, total] = await Promise.all([
    prisma.empresa.findMany({
      where,
      orderBy: { [safeOrder]: direction },
      skip,
      take,
    }),
    prisma.empresa.count({ where }),
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
 * Obtiene una empresa por su ID (UUID).
 *
 * @param {string} id - ID de la empresa.
 * @returns {Promise<Empresa>} La empresa encontrada.
 * @throws {TalentFlowError} 404 si no existe la empresa.
 */
async function getById(id) {
  const currentUser = getCurrentUser()
  if(!hasRol(currentUser, TF_SYS_ADMIN)) {
    throw new TalentFlowError(`No tiene permisos para esta acción`, 403)
  }
  const item = await prisma.empresa.findUnique({ where: { id } })
  if (!item) throw new TalentFlowError('Empresa no encontrada.', 404)
  return item
}

/**
 * Crea una nueva empresa.
 * Toma `uc` y `um` del usuario actual vía `getCurrentUser()`.
 * No realiza validaciones de negocio (eso se hace en controllers).
 *
 * @param {{ nombre?: string, razonSocial?: string, ruc?: string, estado?: string }} [input={}] - Datos a persistir.
 * @returns {Promise<Empresa>} La empresa creada.
 * @throws {TalentFlowError} 409 si viola una restricción de unicidad; otros errores de base.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    if(!hasRol(currentUser, TF_SYS_ADMIN)) {
      throw new TalentFlowError(`No tiene permisos para esta acción`, 403)
    }
    const data = pick(input, ALLOWED_FIELDS)
    // Auditoría
    data.uc = currentUser.id
    data.um = currentUser.id

    const created = await prisma.empresa.create({ data })
    return created
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Empresa' })
  }
}

/**
 * Actualiza parcialmente una empresa existente.
 * Sólo se consideran los campos permitidos (`nombre`, `razonSocial`, `ruc`, `estado`).
 * Setea `um` con el usuario actual vía `getCurrentUser()`.
 *
 * @param {string} id - ID de la empresa.
 * @param {{ nombre?: string, razonSocial?: string, ruc?: string, estado?: string }} [input={}] - Campos a actualizar.
 * @returns {Promise<Empresa>} La empresa actualizada.
 * @throws {TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    if(!hasRol(currentUser, TF_SYS_ADMIN)) {
      throw new TalentFlowError(`No tiene permisos para esta acción`, 403)
    }
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    // Si no viene ningún campo editable, actualizamos solo auditoría (um) para no fallar
    const updated = await prisma.empresa.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Empresa' })
  }
}

/**
 * Elimina una empresa por ID.
 *
 * @param {string} id - ID de la empresa.
 * @returns {Promise<Empresa>} El registro eliminado.
 * @throws {TalentFlowError} 404 si no existe; 409 si tiene relaciones que impiden borrar; otros errores de base.
 */
async function remove(id) {
  try {
    const currentUser = getCurrentUser()
    if(!hasRol(currentUser, TF_SYS_ADMIN)) {
      throw new TalentFlowError(`No tiene permisos para esta acción`, 403)
    }
    const deleted = await prisma.empresa.delete({ where: { id } })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Empresa' })
  }
}

export const EmpresaService = {
  getAll,
  getById,
  post,
  patch,
  delete: remove, // alias
  remove,
}
