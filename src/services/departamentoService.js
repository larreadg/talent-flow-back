// src/services/departamentoService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Departamento} Departamento */

/** Campos permitidos para crear/actualizar Departamento */
const ALLOWED_FIELDS = ['nombre']

/**
 * Lista departamentos con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} params Parámetros de consulta.
 * @param {string} params.empresaId Filtra por empresa.
 * @returns {Promise<{data: Departamento[], meta: {total: number}}>}
 * Resultado paginado con el arreglo de sedes y metadatos de paginación.
 * @throws {TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getAll({ empresaId } = {}) {
  const data = await prisma.departamento.findMany({
    where: {
      empresaId
    },
    select: { nombre: true, id: true },
    orderBy: {
      nombre: 'asc'
    }
  })

  return {
    data,
    meta: {
      total: data.length
    },
  }
}

/**
 * Obtiene un departamento por su ID (UUID).
 *
 * @param {string} id - ID del departamento.
 * @returns {Promise<Departamento>} El departamento encontrado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe.
 */
async function getById(id) {
  const item = await prisma.departamento.findUnique({ where: { id } })
  if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'Departamento' })
  return item
}

/**
 * Lista departamentos de una empresa con paginación/búsqueda/ordenamiento.
 *
 * @param {string} empresaId - ID de la empresa.
 * @param {Object} [params={}] Parámetros de consulta (page, pageSize, q, orderBy, order).
 * @returns {Promise<{data: Departamento[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {import('../utils/error.js').TalentFlowError} Cuando ocurre un error al consultar la base.
 */
async function getByEmpresa() {
  const currentUser = getCurrentUser()
  return getAll({ empresaId: currentUser.empresaId })
}

/**
 * Crea un nuevo departamento (global por empresa).
 * Auditoría: `uc` y `um` se setean con el usuario actual vía `getCurrentUser()`.
 * Sin validaciones de negocio aquí (van en controllers).
 *
 * @param {Partial<Departamento>} [input={}] - Datos a persistir.
 * @returns {Promise<Departamento>} El departamento creado.
 * @throws {import('../utils/error.js').TalentFlowError} 409 si viola unicidad; otros errores de base.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.uc = currentUser.id
    data.um = currentUser.id
    data.empresaId = currentUser.empresaId

    const created = await prisma.departamento.create({ data })
    return created
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Departamento' })
  }
}

/**
 * Actualiza parcialmente un departamento existente.
 * Solo considera los campos permitidos (`empresaId`, `nombre`, `codigo`, `parentId`).
 * Auditoría: setea `um` con el usuario actual.
 *
 * @param {string} id - ID del departamento.
 * @param {Partial<Departamento>} [input={}] - Campos a actualizar.
 * @returns {Promise<Departamento>} El departamento actualizado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    const updated = await prisma.departamento.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Departamento' })
  }
}

/**
 * Elimina un departamento por ID.
 *
 * @param {string} id - ID del departamento.
 * @returns {Promise<Departamento>} El registro eliminado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si tiene relaciones que impiden borrar; otros errores de base.
 */
async function remove(id) {
  try {
    const deleted = await prisma.departamento.delete({ where: { id } })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Departamento' })
  }
}

export const DepartamentoService = {
  getAll,
  getById,
  getByEmpresa,
  post,
  patch,
  delete: remove,
  remove,
}
