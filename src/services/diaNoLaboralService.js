// src/services/diaNoLaboralService.js
import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'
import { toDateOnly, addBusinessDaysInclusive } from '../utils/vacanteUtils.js'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import minMax from 'dayjs/plugin/minMax.js'
dayjs.extend(utc)
dayjs.extend(minMax)

/** @typedef {import('@prisma/client').DiaNoLaboral} DiaNoLaboral */

const ALLOWED_FIELDS = [
  'tipo',
  'nombre',
  'fecha',
]

// Helpers de fecha (YYYY-MM-DD)
const toYMD = (d) => (d ? dayjs.utc(d).format('YYYY-MM-DD') : null)
const fromYMD = (s) => dayjs.utc(`${s}T00:00:00.000Z`).toDate()

/**
 * Determina si la fecha (Date o YYYY-MM-DD) es >= hoy (UTC, date-only).
 * @param {string|Date} input
 */
function assertDateGteToday(input) {
  const target = toDateOnly(input) // normaliza a Date-only UTC 00:00
  const today = toDateOnly(new Date())
  if (dayjs.utc(target).isBefore(dayjs.utc(today), 'day')) {
    throw new TalentFlowError('La fecha del día no laboral debe ser mayor o igual a hoy.', 400)
  }
}

/**
 * Reconstruye completamente los vínculos VacanteDiaNoLaboral de una vacante,
 * en base a las ventanas real/plan de cada etapa.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} vacanteId
 * @param {string} empresaId
 */
async function rebuildVacanteDiaNoLaboral(tx, vacanteId, empresaId) {
  // Traer feriados de la empresa (map y set por fecha YYYY-MM-DD)
  const feriados = await tx.diaNoLaboral.findMany({
    where: { empresaId },
    select: { id: true, fecha: true }
  })
  const holidaySet = new Set(feriados.map(f => dayjs.utc(f.fecha).format('YYYY-MM-DD')))
  const holidayMap = new Map(feriados.map(f => [dayjs.utc(f.fecha).format('YYYY-MM-DD'), f.id]))

  // Etapas de la vacante, ordenadas
  const etapas = await tx.vacanteEtapa.findMany({
    where: { vacanteId },
    orderBy: { procesoEtapa: { orden: 'asc' } },
    select: { id: true, estado: true, fechaInicio: true, fechaFinalizacion: true, fechaCumplimiento: true }
  })

  // Limpiar vínculos actuales
  await tx.vacanteDiaNoLaboral.deleteMany({ where: { vacanteId } })

  // Recolectar feriados dentro de las ventanas
  const holidayKeysToCreate = new Set()

  const collectBetween = (startIso, endIso) => {
    let d = dayjs.utc(startIso)
    const end = dayjs.utc(endIso)
    while (!d.isAfter(end, 'day')) {
      const key = d.format('YYYY-MM-DD')
      if (holidaySet.has(key)) holidayKeysToCreate.add(key)
      d = d.add(1, 'day')
    }
  }

  for (const e of etapas) {
    if (!e.fechaInicio) continue
    const start = dayjs.utc(e.fechaInicio).format('YYYY-MM-DD')
    let end = null
    if (e.estado === 'finalizada' && e.fechaCumplimiento) {
      end = dayjs.utc(e.fechaCumplimiento).format('YYYY-MM-DD')
    } else if (e.fechaFinalizacion) {
      end = dayjs.utc(e.fechaFinalizacion).format('YYYY-MM-DD')
    }
    if (!end) continue
    collectBetween(start, end)
  }

  // Crear vínculos calculados
  const currentUser = getCurrentUser()
  for (const key of holidayKeysToCreate) {
    const diaNoLaboralId = holidayMap.get(key)
    if (!diaNoLaboralId) continue
    await tx.vacanteDiaNoLaboral.create({
      data: {
        vacanteId,
        diaNoLaboralId,
        uc: currentUser.id,
        um: currentUser.id,
      },
    })
  }
}

/**
 * Dado un YMD, devuelve true si está dentro del periodo de la vacante:
 * start = mínimo fechaInicio definida en etapas
 * end   = máximo entre fechaCumplimiento||fechaFinalizacion de cada etapa
 * Solo se consideran vacantes no finalizadas (abierta/pausada).
 *
 * @param {import('@prisma/client').Vacante & { etapasVacante: any[] }} vac
 * @param {string} ymd
 */
function isYmdInsideVacantePeriod(vac, ymd) {
  if (!vac || vac.estado === 'finalizada') return false
  const etapas = (vac.etapasVacante || []).filter(e => e.fechaInicio || e.fechaFinalizacion || e.fechaCumplimiento)
  if (!etapas.length) return false

  const starts = etapas.map(e => e.fechaInicio).filter(Boolean).map(d => dayjs.utc(d))
  if (!starts.length) return false
  const startMin = dayjs.min(starts).format('YYYY-MM-DD')

  const ends = etapas.map(e => e.fechaCumplimiento || e.fechaFinalizacion).filter(Boolean).map(d => dayjs.utc(d))
  if (!ends.length) return false
  const endMax = dayjs.max(ends).format('YYYY-MM-DD')

  return (ymd >= startMin && ymd <= endMax)
}

/**
 * Reabrir y recalcular TODAS las etapas de vacantes afectadas por un feriado YMD.
 * - Vacantes de la empresa del usuario
 * - Estado != 'finalizada' (abierta/pausada)
 * - El YMD cae dentro del periodo de la vacante
 * - Se recalcula desde 0 usando addBusinessDaysInclusive con todos los feriados de la empresa.
 *
 * @param {string} empresaId
 * @param {string} holidayYmd  YYYY-MM-DD
 */
async function reopenAndRecalculateAffectedVacantes(empresaId, holidayYmd) {
  const currentUser = getCurrentUser()

  // Cargar TODAS las vacantes de la empresa con sus etapas (para filtrar en memoria)
  const vacantes = await prisma.vacante.findMany({
    where: {
      empresaId,
      activo: true,
      estado: { in: ['abierta', 'pausada'] }, // afectamos abiertas/pausadas
    },
    include: {
      etapasVacante: {
        orderBy: { procesoEtapa: { orden: 'asc' } },
        select: {
          id: true,
          estado: true,
          fechaInicio: true,
          fechaFinalizacion: true,
          fechaCumplimiento: true,
          procesoEtapa: {
            select: {
              id: true,
              orden: true,
              etapa: { select: { slaDias: true } },
            },
          },
        },
      },
    },
  })

  // Filtrar vacantes afectadas por el nuevo feriado
  const affected = vacantes.filter(v => isYmdInsideVacantePeriod(v, holidayYmd) && v.fechaInicio)
  if (!affected.length) return { affected: 0 }

  // Ejecutar recálculo en transacción
  await prisma.$transaction(async (tx) => {
    // Traer feriados de la empresa (set de YYYY-MM-DD)
    const feriados = await tx.diaNoLaboral.findMany({
      where: { empresaId },
      select: { id: true, fecha: true },
    })
    const holidaySet = new Set(feriados.map(f => dayjs.utc(f.fecha).format('YYYY-MM-DD')))

    for (const vac of affected) {
      const plan = await tx.procesoEtapa.findMany({
        where: { procesoId: vac.procesoId },
        orderBy: { orden: 'asc' },
        select: { id: true, orden: true, etapa: { select: { slaDias: true } } }
      })
      if (!plan.length) continue

      // Recalcular cronograma desde fechaInicio de la vacante
      let cursor = dayjs.utc(vac.fechaInicio)
      const holidayKeysHit = new Set()
      const etapasNew = []

      for (const [index, p] of plan.entries()) {
        const sla = Number(p.etapa.slaDias) || 0
        const { start, end, skippedHolidayKeys } = addBusinessDaysInclusive(cursor, Math.max(1, sla), holidaySet)
        skippedHolidayKeys.forEach(k => holidayKeysHit.add(k))

        etapasNew.push({
          procesoEtapaId: p.id,
          fechaInicio: fromYMD(start.format('YYYY-MM-DD')),
          fechaFinalizacion: fromYMD(end.format('YYYY-MM-DD')),
          estado: index === 0 ? 'abierta' : 'pendiente',
        })

        cursor = end // la siguiente arranca el mismo día que finaliza la anterior
      }

      // 1) Reabrir la vacante (si estaba pausada/cerrada) y auditar
      await tx.vacante.update({
        where: { id: vac.id },
        data: { estado: 'abierta', um: currentUser.id },
      })

      // 2) Actualizar etapas: fechas plan y limpiar fechaCumplimiento (reabrir desde 0)
      for (const e of etapasNew) {
        const existing = await tx.vacanteEtapa.findFirst({
          where: { vacanteId: vac.id, procesoEtapaId: e.procesoEtapaId },
          select: { id: true },
        })
        if (existing) {
          await tx.vacanteEtapa.update({
            where: { id: existing.id },
            data: {
              fechaInicio: e.fechaInicio,
              fechaFinalizacion: e.fechaFinalizacion,
              fechaCumplimiento: null,
              estado: e.estado,
              um: currentUser.id,
            },
          })
        }
      }

      // 3) Exactitud total: borrar y reconstruir vínculos en base a ventanas real/plan
      await rebuildVacanteDiaNoLaboral(tx, vac.id, empresaId)
    }
  })

  return { affected: affected.length }
}

/**
 * Lista días no laborales por empresa del usuario actual.
 * Si el tipo es "nacional", empresaId queda en null.
 *
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
    data: data.map(el => { return { ...el, fecha: el.fecha.toISOString().slice(0, 10) } }),
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
 * Reglas:
 *  - fecha >= hoy (UTC, date-only)
 *  - unicidad (empresaId, nombre, fecha)
 *  - si afecta periodos de vacantes => reabrir y recalcular desde 0
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

    // Validar fecha >= hoy
    assertDateGteToday(data.fecha)

    // Auditoría + empresa
    data.uc = currentUser.id
    data.um = currentUser.id
    data.empresaId = currentUser.empresaId

    // Convertir a Date-only (Postgres DATE)
    data.fecha = toDateOnly(data.fecha)

    // Verificar unicidad (empresaId + nombre + fecha)
    const exists = await prisma.diaNoLaboral.findFirst({
      where: {
        empresaId: data.empresaId,
        nombre: data.nombre,
        fecha: data.fecha,
      },
      select: { id: true },
    })

    console.log(exists)

    if (exists) {
      throw new TalentFlowError(
        'Ya existe un día no laboral con ese nombre y fecha para esta empresa.',
        409
      )
    }

    // Crear el feriado
    const created = await prisma.diaNoLaboral.create({ data })

    // Recalcular vacantes afectadas por este nuevo feriado
    const ymd = toYMD(created.fecha)
    await reopenAndRecalculateAffectedVacantes(currentUser.empresaId, ymd)

    return created
  } catch (e) {
    console.log(e)
    throw mapPrismaError(e, { resource: 'Día no laboral' })
  }
}

/**
 * Actualiza parcialmente un día no laboral.
 * Reglas:
 *  - si viene "fecha", debe ser >= hoy
 *  - unicidad (empresaId, nombre, fecha) excluyendo el mismo id
 *  - tras actualizar, si la "fecha" (nueva o existente) cae dentro del periodo de vacantes,
 *    reabrir y recalcular desde 0
 *
 * @param {string} id
 * @param {Partial<DiaNoLaboral>} input
 * @returns {Promise<DiaNoLaboral>}
 */
async function patch(id, input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)

    // Normalizar y validar fecha si viene
    if ('fecha' in data && data.fecha != null) {
      assertDateGteToday(data.fecha)
      data.fecha = toDateOnly(data.fecha)
    }

    // Traer actual para empresaId / defaults
    const existing = await prisma.diaNoLaboral.findUnique({ where: { id } })
    if (!existing) throw new TalentFlowError('Día no laboral no encontrado', 404)

    const targetNombre = ('nombre' in data) ? data.nombre : existing.nombre
    const targetFecha = ('fecha' in data) ? data.fecha : existing.fecha

    // Validación de unicidad (empresaId + nombre + fecha), excluyendo este id
    if (('nombre' in data) || ('fecha' in data)) {
      const dup = await prisma.diaNoLaboral.findFirst({
        where: {
          id: { not: id },
          empresaId: existing.empresaId,
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

    // Armar payload con campos presentes + auditoría
    const payload = {}
    if ('nombre' in data) payload.nombre = data.nombre
    if ('tipo' in data) payload.tipo = data.tipo
    if ('fecha' in data) payload.fecha = data.fecha
    payload.um = currentUser.id

    const updated = await prisma.diaNoLaboral.update({
      where: { id },
      data: payload,
    })

    // Recalcular vacantes afectadas por la fecha (nueva o actual)
    const ymd = toYMD(updated.fecha)
    await reopenAndRecalculateAffectedVacantes(existing.empresaId, ymd)

    return updated
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Día no laboral' })
  }
}

/**
 * Elimina un día no laboral.
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
