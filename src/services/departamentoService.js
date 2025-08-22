// src/services/departamentoService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Departamento} Departamento */

/** Campos permitidos para crear/actualizar Departamento */
const ALLOWED_FIELDS = ['empresaId', 'nombre', 'codigo', 'parentId']

/**
 * Lista departamentos con paginación, búsqueda y ordenamiento.
 *
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `nombre` o `codigo`.
 * @param {'nombre'|'codigo'|'fc'|'fm'} [params.orderBy='nombre'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @param {string} [params.empresaId] (opcional) Filtra por empresa.
 * @returns {Promise<{data: Departamento[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * Resultado paginado con los departamentos y metadatos de paginación.
 * @throws {import('../utils/error.js').TalentFlowError} Cuando ocurre un error al consultar la base.
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
          ],
        }
      : null),
  }

  const safeOrder = ['nombre', 'codigo', 'fc', 'fm'].includes(orderBy) ? orderBy : 'nombre'
  const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'
  const whereOrUndefined = Object.keys(where).length ? where : undefined

  const [data, total] = await Promise.all([
    prisma.departamento.findMany({
      where: whereOrUndefined,
      orderBy: { [safeOrder]: direction },
      skip,
      take,
    }),
    prisma.departamento.count({ where: whereOrUndefined }),
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
async function getByEmpresa(empresaId, params = {}) {
  return getAll({ ...params, empresaId })
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
