// src/services/sedeService.js
import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Sede} Sede */

const ALLOWED_FIELDS = [
  'nombre',
  'direccion',
  'ciudad',
  'pais',
]

/**
 * Lista sedes con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} params Parámetros de consulta.
 * @param {string} params.empresaId Filtra por empresa.
 * @returns {Promise<{data: Sede[], meta: {total: number}}>}
 * Resultado paginado con el arreglo de sedes y metadatos de paginación.
 * @throws {TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getAll({ empresaId }) {
  
  const data = await prisma.sede.findMany({
    where: {
      empresaId
    },
    select: { nombre: true, direccion: true, ciudad: true, pais: true, id: true }
  })

  return {
    data,
    meta: {
      total: data.length
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
async function getByEmpresa() {
  const currentUser = getCurrentUser()
  return getAll({ empresaId: currentUser.empresaId })
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
    data.empresaId = currentUser.empresaId

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
