// src/services/equipoService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').Equipo} Equipo */

/** Campos permitidos para crear/actualizar Equipo */
const ALLOWED_FIELDS = ['empresaId', 'sedeId', 'departamentoId', 'nombre', 'codigo', 'tipo']

/**
 * Lista equipos de una empresa con paginación, búsqueda y ordenamiento.
 *
 * @param {string} empresaId - ID de la empresa (UUID).
 * @param {Object} [params={}] Parámetros de consulta.
 * @param {number} [params.page=1] Número de página (>= 1).
 * @param {number} [params.pageSize=25] Tamaño de página (>= 1).
 * @param {string} [params.q] Texto a buscar en `nombre`, `codigo` o `tipo`.
 * @param {'nombre'|'codigo'|'tipo'|'fc'|'fm'} [params.orderBy='nombre'] Campo para ordenar.
 * @param {'asc'|'desc'} [params.order='asc'] Dirección del orden.
 * @param {string} [params.sedeId] (opcional) Filtra por sede.
 * @param {string} [params.departamentoId] (opcional) Filtra por departamento.
 * @returns {Promise<{data: Equipo[], meta: {page: number, pageSize: number, total: number, totalPages: number}}>}
 * @throws {import('../utils/error.js').TalentFlowError}
 */
async function getByEmpresa(
  empresaId,
  { page = 1, pageSize = 25, q, orderBy = 'nombre', order = 'asc', sedeId, departamentoId } = {}
) {
  try {
    const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
    const take = Math.max(1, Number(pageSize))

    const where = {
      empresaId,
      ...(sedeId ? { sedeId } : null),
      ...(departamentoId ? { departamentoId } : null),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
              { tipo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : null),
    }

    const safeOrder = ['nombre', 'codigo', 'tipo', 'fc', 'fm'].includes(orderBy) ? orderBy : 'nombre'
    const direction = order?.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const [data, total] = await Promise.all([
      prisma.equipo.findMany({
        where,
        orderBy: { [safeOrder]: direction },
        skip,
        take,
      }),
      prisma.equipo.count({ where }),
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
    throw mapPrismaError(e, { resource: 'Equipo' })
  }
}

/**
 * Obtiene un equipo por su ID (UUID).
 *
 * @param {string} id - ID del equipo.
 * @returns {Promise<Equipo>} El equipo encontrado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe.
 */
async function getById(id) {
  try {
    const item = await prisma.equipo.findUnique({ where: { id } })
    if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'Equipo' })
    return item
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Equipo' })
  }
}

/**
 * Crea un nuevo equipo (puede ser por sede y opcionalmente atado a un departamento).
 * Auditoría: `uc` y `um` se setean con el usuario actual vía `getCurrentUser()`.
 * Sin validaciones de negocio aquí (van en controllers).
 *
 * @param {Partial<Equipo>} [input={}] - Datos a persistir.
 * @returns {Promise<Equipo>} El equipo creado.
 * @throws {import('../utils/error.js').TalentFlowError} 409 si viola unicidad; otros errores de base.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.uc = currentUser.id
    data.um = currentUser.id

    const created = await prisma.equipo.create({ data })
    return created
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Equipo' })
  }
}

/**
 * Actualiza parcialmente un equipo existente.
 * Considera: `empresaId`, `sedeId`, `departamentoId`, `nombre`, `codigo`, `tipo`.
 * Auditoría: setea `um` con el usuario actual.
 *
 * @param {string} id - ID del equipo.
 * @param {Partial<Equipo>} [input={}] - Campos a actualizar.
 * @returns {Promise<Equipo>} El equipo actualizado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si viola unicidad; otros errores de base.
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)
    data.um = currentUser.id

    const updated = await prisma.equipo.update({
      where: { id },
      data: Object.keys(data).length ? data : { um: currentUser.id },
    })
    return updated
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Equipo' })
  }
}

/**
 * Elimina un equipo por ID.
 *
 * @param {string} id - ID del equipo.
 * @returns {Promise<Equipo>} El registro eliminado.
 * @throws {import('../utils/error.js').TalentFlowError} 404 si no existe; 409 si tiene relaciones que impiden borrar; otros errores de base.
 */
async function remove(id) {
  try {
    const deleted = await prisma.equipo.delete({ where: { id } })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Equipo' })
  }
}

export const EquipoService = {
  getByEmpresa,
  getById,
  post,
  patch,
  delete: remove,
  remove,
}
