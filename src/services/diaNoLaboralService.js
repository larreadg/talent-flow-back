// src/services/diaNoLaboralService.js
import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'

/** @typedef {import('@prisma/client').DiaNoLaboral} DiaNoLaboral */

const ALLOWED_FIELDS = [
  'tipo',
  'nombre',
  'fecha',
]

/**
 * Lista días no laborales por empresa del usuario actual.
 * Si el tipo es "nacional", empresaId queda en null.
 *
 * @param {Object} params Parámetros opcionales.
 * @returns {Promise<{data: DiaNoLaboral[], meta: {total: number}}>}
 */
async function getAll() {
  const currentUser = getCurrentUser()
  const data = await prisma.diaNoLaboral.findMany({
    where: {
      empresaId: currentUser.empresaId
    },
    orderBy: { fecha: 'asc' },
  })

  return {
    data: data.map(el => { return { ...el, fecha: el.fecha.toISOString().slice(0, 10) }}),
    meta: { total: data.length },
  }
}

/**
 * Obtiene un día no laboral por su ID.
 *
 * @param {string} id - ID del día no laboral.
 * @returns {Promise<DiaNoLaboral>}
 */
async function getById(id) {
  const item = await prisma.diaNoLaboral.findUnique({ where: { id } })
  if (!item || !item.activo) throw new TalentFlowError('Día no laboral no encontrado.', 404)
  return item
}

/**
 * Crea un nuevo día no laboral.
 *
 * @param {Partial<DiaNoLaboral>} input
 * @returns {Promise<DiaNoLaboral>}
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)

    if (!data.fecha) {
      throw new TalentFlowError('El campo "fecha" es obligatorio (YYYY-MM-DD).', 400)
    }

    // Auditoría + empresa
    data.uc = currentUser.id
    data.um = currentUser.id
    data.empresaId = currentUser.empresaId

    // Convertir string → Date (Postgres DATE guarda solo la parte de fecha)
    data.fecha = new Date(data.fecha)

    // Verificar unicidad (empresaId + nombre + fecha)
    const exists = await prisma.diaNoLaboral.findFirst({
      where: {
        empresaId: data.empresaId,
        nombre: data.nombre,
        fecha: data.fecha,
      },
      select: { id: true },
    })

    if (exists) {
      throw new TalentFlowError(
        'Ya existe un día no laboral con ese nombre y fecha para esta empresa.',
        409
      )
    }

    return await prisma.diaNoLaboral.create({ data })
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Día no laboral' })
  }
}


/**
 * Actualiza parcialmente un día no laboral.
 * Regla de unicidad: (empresaId, nombre, fecha) excluyendo el mismo id.
 *
 * @param {string} id
 * @param {Partial<DiaNoLaboral>} input
 * @returns {Promise<DiaNoLaboral>}
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)

    // Normalizar fecha sólo si viene (YYYY-MM-DD garantizado por validator)
    if ('fecha' in data && data.fecha != null) {
      data.fecha = new Date(data.fecha)
    }

    // Traer el registro actual (fuente de empresaId y valores por defecto)
    const existing = await prisma.diaNoLaboral.findUnique({ where: { id } })
    if (!existing) throw new TalentFlowError('Día no laboral no encontrado', 404)

    // Valores objetivo (post-patch) para validar duplicado
    const targetNombre = ('nombre' in data) ? data.nombre : existing.nombre
    const targetFecha  = ('fecha'  in data) ? data.fecha  : existing.fecha

    // Validación de unicidad (empresaId + nombre + fecha), excluyendo este id
    if (('nombre' in data) || ('fecha' in data)) {
      const dup = await prisma.diaNoLaboral.findFirst({
        where: {
          id: { not: id },
          empresaId: existing.empresaId, // NO se parchea
          nombre: targetNombre,
          fecha: targetFecha,
        },
        select: { id: true },
      })
      if (dup) {
        throw new TalentFlowError(
          'Ya existe un día no laboral con ese nombre y fecha para esta empresa.',
          409
        )
      }
    }

    // Armar payload únicamente con campos presentes en input + auditoría
    const payload = {}
    if ('nombre' in data) payload.nombre = data.nombre
    if ('descripcion' in data) payload.descripcion = data.descripcion
    if ('tipo' in data) payload.tipo = data.tipo
    if ('fecha' in data) payload.fecha = data.fecha
    payload.um = currentUser.id

    // Si no hay cambios aparte de um, igual actualizamos para auditar
    const updated = await prisma.diaNoLaboral.update({
      where: { id },
      data: payload,
    })

    return updated
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Día no laboral' })
  }
}

/**
 * Elimina un dia no laboral
 *
 * @param {string} id
 * @returns {Promise<DiaNoLaboral>}
 */
async function remove(id) {
  try {
    const deleted = await prisma.diaNoLaboral.delete({
      where: { id },
    })
    return deleted
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Día no laboral' })
  }
}

export const DiaNoLaboralService = {
  getAll,
  getById,
  post,
  patch,
  delete: remove,
  remove,
}
