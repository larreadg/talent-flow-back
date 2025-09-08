import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { toDateOnly, addBusinessDaysInclusive } from '../utils/vacanteUtils.js'
import { pick } from '../utils/utils.js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

const PATCH_ALLOWED = ['nombre', 'departamentoId', 'sedeId', 'fechaInicio', 'estado']

/**
 * GET: Lista vacantes por empresa del usuario actual con paginación y filtro.
 * Params opcionales:
 * - limit  (default 10)
 * - offset (default 0)
 * - filter (default null) -> busca en Vacante.nombre, Proceso.nombre, Departamento.nombre, Etapa.nombre
 *
 * Incluye:
 * - proceso (nombre)
 * - departamento (nombre)
 * - etapasVacante (ordenadas por procesoEtapa.orden) con datos de Etapa (nombre, slaDias)
 * - diasNoLaborales (ordenados por diaNoLaboral.fecha) con datos de DiaNoLaboral (id, nombre, fecha)
 */
async function getByEmpresa({ limit = 10, offset = 0, filter = null } = {}) {
    try {
        const currentUser = getCurrentUser()

        // Normalización
        const take = Number.isInteger(limit) && limit > 0 ? limit : 10
        const skip = Number.isInteger(offset) && offset >= 0 ? offset : 0
        const text = (typeof filter === 'string' && filter.trim()) ? filter.trim() : null

        // WHERE base
        const baseWhere = {
            empresaId: currentUser.empresaId,
            activo: true,
        }

        const STATES = ['abierta', 'pausada', 'cerrada', 'cancelada']; // as const
        const lc = filter?.toLowerCase() ?? '';
        const matchedStates = STATES.filter(s => s.includes(lc)); // permite "abier", "CERRA", etc.

        // WHERE con filtro opcional (case-insensitive)
        const where = text
            ? {
                ...baseWhere,
                OR: [
                    ...(matchedStates.length ? [{ estado: { in: matchedStates } }] : []), // Vacante.estado (enum) → usar IN, no contains
                    { nombre: { contains: text, mode: 'insensitive' } }, // Vacante.nombre
                    { departamento: { nombre: { contains: text, mode: 'insensitive' } } }, // Departamento.nombre
                    { sede: { nombre: { contains: text, mode: 'insensitive' } } }, // Sede.nombre
                ],
            }
            : baseWhere

        // Total para meta
        const total = await prisma.vacante.count({ where })

        const vacantes = await prisma.vacante.findMany({
            where,
            orderBy: { nombre: 'asc' },
            skip,
            take,
            include: {
                proceso: { select: { nombre: true } },
                departamento: { select: { nombre: true } },
                sede: { select: { nombre: true } },
                etapasVacante: {
                    orderBy: { procesoEtapa: { orden: 'asc' } },
                    include: {
                        procesoEtapa: {
                            select: {
                                id: true,
                                orden: true,
                                etapa: { select: { nombre: true, slaDias: true } },
                            },
                        },
                    },
                },
                // NUEVO: Días no laborales que afectan a la vacante
                diasNoLaborales: {
                    orderBy: { diaNoLaboral: { fecha: 'asc' } },
                    include: {
                        diaNoLaboral: {
                            select: {
                                id: true,
                                nombre: true,
                                fecha: true,
                            },
                        },
                    },
                },
            },
        })

        return {
            data: vacantes.map(el => { return { ...el, fechaInicio: el.fechaInicio.toISOString().slice(0, 10) } }),
            meta: {
                total,
                limit: take,
                offset: skip,
                returned: vacantes.length,
                hasMore: skip + vacantes.length < total,
            },
        }
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Vacante' })
    }
}


/**
 * POST: Crea una Vacante con sus VacanteEtapa calculadas.
 *
 * Body esperado:
 * - nombre: string (requerido)
 * - procesoId: string (UUID) (requerido)
 * - fechaInicio: string (YYYY-MM-DD) o Date (requerido)
 * - departamentoId: string (UUID)
 * - sedeId: string (UUID)
 */
async function post(input) {
    try {
        const currentUser = getCurrentUser()
        const { nombre, procesoId, fechaInicio, departamentoId, sedeId } = input

        const nombreTrim = String(nombre).trim()
        const fechaInicioDate = toDateOnly(fechaInicio)

        // Verificar que el proceso exista y pertenezca a la empresa
        const proceso = await prisma.proceso.findFirst({
            where: { id: procesoId, empresaId: currentUser.empresaId },
            select: { id: true, empresaId: true },
        })
        if (!proceso) {
            throw new TalentFlowError('El proceso no existe o no pertenece a la empresa del usuario.', 400)
        }

        // (Opcional) validar que el departamento pertenezca a la misma empresa
        if (departamentoId) {
            const depto = await prisma.departamento.findFirst({
                where: { id: departamentoId, empresaId: currentUser.empresaId },
                select: { id: true },
            })
            if (!depto) {
                throw new TalentFlowError('El departamento no existe o no pertenece a la empresa del usuario.', 400)
            }
        }

        // Unicidad de la Vacante (estado por defecto = 'abierta')
        const exists = await prisma.vacante.findFirst({
            where: {
                empresaId: currentUser.empresaId,
                procesoId,
                nombre: nombreTrim,
                fechaInicio: fechaInicioDate,
                departamentoId: departamentoId ?? null,
                estado: 'abierta',
                sedeId
            },
            select: { id: true },
        })
        if (exists) {
            throw new TalentFlowError(
                'Ya existe una vacante con esos datos (empresa, proceso, nombre, fechaInicio, departamento, sede, estado).',
                409
            )
        }

        // Traer el plan del proceso (orden + slaDias por etapa)
        const plan = await prisma.procesoEtapa.findMany({
            where: { procesoId },
            orderBy: { orden: 'asc' },
            select: {
                id: true,
                orden: true,
                etapa: { select: { id: true, nombre: true, slaDias: true } },
            },
        })
        if (!plan.length) {
            throw new TalentFlowError('El proceso seleccionado no tiene etapas configuradas.', 400)
        }

        // Traer días no laborables de la empresa (mapear por fecha)
        const feriados = await prisma.diaNoLaboral.findMany({
            where: { empresaId: currentUser.empresaId },
            select: { id: true, fecha: true },
        })
        const holidayMap = new Map() // key: 'YYYY-MM-DD' -> id
        const holidaySet = new Set()
        for (const f of feriados) {
            const key = dayjs.utc(f.fecha).format('YYYY-MM-DD') // ← UTC
            holidaySet.add(key)
            // si hay duplicados por fecha, conservamos el primero; si querés, podés juntar arrays
            if (!holidayMap.has(key)) holidayMap.set(key, f.id)
        }

        // Calcular cronograma por etapas
        let cursor = dayjs.utc(fechaInicioDate)
        /** @type {Array<{ procesoEtapaId: string, fechaInicio: Date, fechaFinalizacion: Date, uc: string, um: string }>} */
        const etapasToCreate = []
        const holidayKeysHit = new Set() // fechas feriado que afectaron el cronograma

        for (const item of plan) {
            const sla = Number(item.etapa.slaDias)

            const { start, end, skippedHolidayKeys } = addBusinessDaysInclusive(cursor, sla, holidaySet)
            skippedHolidayKeys.forEach(k => holidayKeysHit.add(k))

            etapasToCreate.push({
                procesoEtapaId: item.id,
                fechaInicio: new Date(start.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                fechaFinalizacion: new Date(end.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                uc: currentUser.id,
                um: currentUser.id,
            })

            // La siguiente etapa comienza el mismo día que finaliza la anterior (como en tu ejemplo)
            cursor = end
        }

        // Transacción: crear Vacante, sus VacanteEtapa y marcar VacanteDiaNoLaboral
        const created = await prisma.$transaction(async (tx) => {
            const vacante = await tx.vacante.create({
                data: {
                    empresaId: currentUser.empresaId,
                    procesoId,
                    sedeId,
                    nombre: nombreTrim,
                    fechaInicio: fechaInicioDate,
                    departamentoId: departamentoId ?? null,
                    estado: 'abierta',
                    activo: true,
                    uc: currentUser.id,
                    um: currentUser.id,
                },
                select: { id: true },
            })

            // Crear etapas de la vacante respetando el orden ya calculado
            for (const e of etapasToCreate) {
                await tx.vacanteEtapa.create({
                    data: {
                        vacanteId: vacante.id,
                        procesoEtapaId: e.procesoEtapaId,
                        fechaInicio: e.fechaInicio,
                        fechaFinalizacion: e.fechaFinalizacion,
                        comentarios: null,
                        recursos: null,
                        uc: currentUser.id,
                        um: currentUser.id,
                    },
                })
            }

            // Crear vínculos con días no laborales que afectaron el cronograma
            for (const key of holidayKeysHit) {
                const diaNoLaboralId = holidayMap.get(key)
                if (!diaNoLaboralId) continue
                await tx.vacanteDiaNoLaboral.create({
                    data: {
                        vacanteId: vacante.id,
                        diaNoLaboralId,
                        uc: currentUser.id,
                        um: currentUser.id,
                    },
                })
            }

            // Devolver con relaciones útiles
            return tx.vacante.findUnique({
                where: { id: vacante.id },
                include: {
                    proceso: { select: { nombre: true } },
                    departamento: { select: { nombre: true } },
                    etapasVacante: {
                        orderBy: { procesoEtapa: { orden: 'asc' } },
                        include: {
                            procesoEtapa: {
                                select: {
                                    id: true,
                                    orden: true,
                                    etapa: { select: { nombre: true, slaDias: true } },
                                },
                            },
                        },
                    },
                    diasNoLaborales: {
                        orderBy: { diaNoLaboral: { fecha: 'asc' } },
                        include: { diaNoLaboral: { select: { id: true, nombre: true, fecha: true } } },
                    },
                },
            })
        })

        return created
    } catch (e) {
        if (e instanceof TalentFlowError) throw e
        throw mapPrismaError(e, { resource: 'Vacante' })
    }
}


/**
 * Actualiza una vacante
 *
 * @param {string} id UUID de la vacante.
 * @param {Object} params Parámetros.
 * @param {string} params.nombre Nombre de la vacante.
 * @param {string} params.departamentoId UUID del departamento.
 * @param {string} params.sedeId UUID de la sede.
 * @param {string} params.fechaInicio Fecha de inicio.
 * @returns {Promise<Vacante>}
 */
async function patch(id, input) {
    try {
        const currentUser = getCurrentUser()
        const data = pick(input, PATCH_ALLOWED)

        // Cargar vacante actual (con empresa, proceso y etapas)
        const current = await prisma.vacante.findFirst({
            where: { id, empresaId: currentUser.empresaId },
            select: {
                id: true,
                empresaId: true,
                procesoId: true,
                nombre: true,
                fechaInicio: true,
                departamentoId: true,
                sedeId: true,
                estado: true
            },
        })
        if (!current) {
            throw new TalentFlowError('Vacante no encontrada o no pertenece a la empresa del usuario.', 404)
        }

        // Normalizaciones y validaciones específicas
        if ('nombre' in data) {
            if (!data.nombre || !String(data.nombre).trim()) {
                throw new TalentFlowError('El nombre no puede ser vacío.', 400)
            }
            data.nombre = String(data.nombre).trim()
        }

        if ('departamentoId' in data && data.departamentoId) {
            const depto = await prisma.departamento.findFirst({
                where: { id: data.departamentoId, empresaId: currentUser.empresaId },
                select: { id: true },
            })
            if (!depto) {
                throw new TalentFlowError('departamentoId no existe o no pertenece a la empresa.', 400)
            }
        }

        if ('sedeId' in data && data.sedeId) {
            const sede = await prisma.sede.findFirst({
                where: { id: data.sedeId, empresaId: currentUser.empresaId },
                select: { id: true },
            })
            if (!sede) {
                throw new TalentFlowError('sedeId no existe o no pertenece a la empresa.', 400)
            }
        }

        let newFechaInicio = null
        let fechaInicioChanged = false
        if ('fechaInicio' in data) {
            newFechaInicio = toDateOnly(data.fechaInicio)
            fechaInicioChanged = !current.fechaInicio || dayjs.utc(current.fechaInicio).format('YYYY-MM-DD') !== dayjs.utc(newFechaInicio).format('YYYY-MM-DD')
            data.fechaInicio = newFechaInicio
        }

        // Unicidad (estado por defecto = 'abierta')
        // Ajustá este WHERE si tu @@unique incluye sedeId; aquí lo contemplamos si está presente en el modelo
        const uniqueCheckWhere = {
            empresaId: currentUser.empresaId,
            procesoId: current.procesoId,
            nombre: ('nombre' in data ? data.nombre : current.nombre),
            fechaInicio: ('fechaInicio' in data ? data.fechaInicio : current.fechaInicio),
            departamentoId: (data.hasOwnProperty('departamentoId') ? (data.departamentoId ?? null) : (current.departamentoId ?? null)),
            // si tu índice único incluye sedeId, agregalo:
            ...(current.hasOwnProperty('sedeId') ? {
                sedeId: (data.hasOwnProperty('sedeId') ? (data.sedeId ?? null) : (current.sedeId ?? null))
            } : {}),
            estado: current.estado,
            sedeId: current.sedeId,
            NOT: { id: current.id },
        }

        const exists = await prisma.vacante.findFirst({
            where: uniqueCheckWhere,
            select: { id: true },
        })
        if (exists) {
            throw new TalentFlowError(
                'Ya existe una vacante con esos datos (empresa, proceso, nombre, fechaInicio, departamento, sede, estado).',
                409
            )
        }

        // Si NO cambia fechaInicio: actualización simple
        if (!fechaInicioChanged) {
            const updated = await prisma.vacante.update({
                where: { id: current.id },
                data: {
                    ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
                    ...(data.departamentoId !== undefined ? { departamentoId: data.departamentoId ?? null } : {}),
                    ...(data.sedeId !== undefined ? { sedeId: data.sedeId ?? null } : {}),
                    ...(data.estado !== undefined ? { estado: data.estado } : {}),
                    um: currentUser.id,
                    // fechaInicio no cambió o no se envió
                },
                include: {
                    proceso: { select: { nombre: true } },
                    departamento: { select: { nombre: true } },
                    etapasVacante: {
                        orderBy: { procesoEtapa: { orden: 'asc' } },
                        include: {
                            procesoEtapa: {
                                select: { id: true, orden: true, etapa: { select: { nombre: true, slaDias: true } } },
                            },
                        },
                    },
                    diasNoLaborales: {
                        orderBy: { diaNoLaboral: { fecha: 'asc' } },
                        include: { diaNoLaboral: { select: { id: true, nombre: true, fecha: true } } },
                    },
                },
            })
            return updated
        }

        // === Recalcular cronograma por cambio de fechaInicio ===

        // Traer plan del proceso
        const plan = await prisma.procesoEtapa.findMany({
            where: { procesoId: current.procesoId },
            orderBy: { orden: 'asc' },
            select: {
                id: true,
                orden: true,
                etapa: { select: { id: true, nombre: true, slaDias: true } },
            },
        })
        if (!plan.length) {
            throw new TalentFlowError('El proceso de la vacante no tiene etapas configuradas.', 400)
        }

        // Días no laborales de la empresa
        const feriados = await prisma.diaNoLaboral.findMany({
            where: { empresaId: currentUser.empresaId },
            select: { id: true, fecha: true },
        })
        const holidayMap = new Map()
        const holidaySet = new Set()
        for (const f of feriados) {
            const key = dayjs.utc(f.fecha).format('YYYY-MM-DD')
            holidaySet.add(key)
            if (!holidayMap.has(key)) holidayMap.set(key, f.id)
        }

        // Calcular nuevas fechas
        let cursor = dayjs.utc(newFechaInicio) 
        const etapasNew = []
        const holidayKeysHit = new Set()

        for (const item of plan) {
            const sla = Number(item.etapa.slaDias) || 0
            const { start, end, skippedHolidayKeys } = addBusinessDaysInclusive(cursor, Math.max(1, sla), holidaySet)
            skippedHolidayKeys.forEach(k => holidayKeysHit.add(k))

            etapasNew.push({
                procesoEtapaId: item.id,
                fechaInicio: new Date(start.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                fechaFinalizacion: new Date(end.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
            })
            // siguiente etapa comienza el mismo día que finaliza la anterior
            cursor = end
        }

        // Transacción: actualizar vacante, recalcular etapas, limpiar/crear VacanteDiaNoLaboral
        const result = await prisma.$transaction(async (tx) => {
            // 1) Update campos base + nueva fechaInicio
            await tx.vacante.update({
                where: { id: current.id },
                data: {
                    ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
                    ...(data.departamentoId !== undefined ? { departamentoId: data.departamentoId ?? null } : {}),
                    ...(data.sedeId !== undefined ? { sedeId: data.sedeId ?? null } : {}),
                    ...(data.estado !== undefined ? { estado: data.estado } : {}),
                    fechaInicio: newFechaInicio,
                    um: currentUser.id,
                },
            })

            // 2) Nullificar fechaCumplimiento y actualizar fechas por cada procesoEtapa
            //    (asumimos que las VacanteEtapa existen; si no, las creamos)
            for (const e of etapasNew) {
                const existing = await tx.vacanteEtapa.findFirst({
                    where: { vacanteId: current.id, procesoEtapaId: e.procesoEtapaId },
                    select: { id: true },
                })
                if (existing) {
                    await tx.vacanteEtapa.update({
                        where: { id: existing.id },
                        data: {
                            fechaInicio: e.fechaInicio,
                            fechaFinalizacion: e.fechaFinalizacion,
                            fechaCumplimiento: null,
                            um: currentUser.id,
                        },
                    })
                } else {
                    // Caso borde: si por alguna razón no existe, la creamos
                    await tx.vacanteEtapa.create({
                        data: {
                            vacanteId: current.id,
                            procesoEtapaId: e.procesoEtapaId,
                            fechaInicio: e.fechaInicio,
                            fechaFinalizacion: e.fechaFinalizacion,
                            fechaCumplimiento: null,
                            comentarios: null,
                            recursos: null,
                            uc: currentUser.id,
                            um: currentUser.id,
                        },
                    })
                }
            }

            // 3) Recalcular relaciones con días no laborables
            await tx.vacanteDiaNoLaboral.deleteMany({ where: { vacanteId: current.id } })
            for (const key of holidayKeysHit) {
                const diaNoLaboralId = holidayMap.get(key)
                if (!diaNoLaboralId) continue
                await tx.vacanteDiaNoLaboral.create({
                    data: {
                        vacanteId: current.id,
                        diaNoLaboralId,
                        uc: currentUser.id,
                        um: currentUser.id,
                    },
                })
            }

            // 4) Devolver entidad completa
            return tx.vacante.findUnique({
                where: { id: current.id },
                include: {
                    proceso: { select: { nombre: true } },
                    departamento: { select: { nombre: true } },
                    etapasVacante: {
                        orderBy: { procesoEtapa: { orden: 'asc' } },
                        include: {
                            procesoEtapa: {
                                select: {
                                    id: true,
                                    orden: true,
                                    etapa: { select: { nombre: true, slaDias: true } },
                                },
                            },
                        },
                    },
                    diasNoLaborales: {
                        orderBy: { diaNoLaboral: { fecha: 'asc' } },
                        include: { diaNoLaboral: { select: { id: true, nombre: true, fecha: true } } },
                    },
                },
            })
        })

        return result
    } catch (e) {
        if (e instanceof TalentFlowError) throw e
        throw mapPrismaError(e, { resource: 'Vacante' })
    }
}

export const VacanteService = {
    getByEmpresa,
    post,
    patch
}
