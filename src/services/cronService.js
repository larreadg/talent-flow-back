import dayjs from 'dayjs'
import { prisma } from '../prismaClient.js'
import { mapPrismaError } from '../utils/error.js'
import nodeCron from 'node-cron'

// Backfill: calcular y persistir diasHabilesFinalizacion para vacantes finalizadas con valor nulo.
export async function backfillDiasHabilesFinalizacionPendientes() {
    try {

        // 1) Traer vacantes objetivo con relaciones necesarias (mismo estilo que getById)
        const vacantes = await prisma.vacante.findMany({
            where: {
                activo: true,
                estado: 'finalizada',
                diasHabilesFinalizacion: null,
            },
            include: {
                etapasVacante: {
                    orderBy: { procesoEtapa: { orden: 'asc' } },
                    include: {
                        procesoEtapa: {
                            select: {
                                id: true,
                                orden: true,
                                responsable: true,
                                etapa: { select: { nombre: true, slaDias: true } },
                            },
                        },
                        _count: { select: { comentarios: true } },
                    },
                },
                diasNoLaborales: {
                    orderBy: { diaNoLaboral: { fecha: 'asc' } },
                    include: {
                        diaNoLaboral: { select: { id: true, nombre: true, fecha: true, tipo: true } },
                    },
                },
            },
        })

        if (!vacantes.length) {
            return { updated: 0, total: 0 }
        }

        // 2) Helpers locales (no agregamos funciones globales)
        const toYMD = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
        const fromYMD = (s) => new Date(s + 'T00:00:00.000Z')
        const addDaysUTC = (date, days) => {
            const d = new Date(date.getTime())
            d.setUTCDate(d.getUTCDate() + days)
            return d
        }

        // 3) Preparar updates
        const updates = []

        for (const vac of vacantes) {
            // Set de feriados asociados a la vacante
            const holidaySet = new Set((vac.diasNoLaborales ?? []).map((vdl) => toYMD(vdl.diaNoLaboral.fecha)))

            const isWorkingDay = (date) => {
                const ymd = toYMD(date)
                const dow = date.getUTCDay() // 0=Dom, 6=Sáb
                if (dow === 0 || dow === 6) return false
                if (holidaySet.has(ymd)) return false
                return true
            }

            const listBusinessDaysInclusive = (startStr, endStr) => {
                const out = []
                if (!startStr || !endStr) return out
                let cur = fromYMD(startStr)
                const end = fromYMD(endStr)
                if (cur > end) return out
                while (cur <= end) {
                    if (isWorkingDay(cur)) out.push(toYMD(cur))
                    cur = addDaysUTC(cur, 1)
                }
                return out
            }

            // Normalizar fechas de etapas como en getById y acumular días hábiles ÚNICOS
            const coveredBusinessDays = new Set()

            for (const eV of vac.etapasVacante ?? []) {
                const fechaInicio = eV.fechaInicio ? toYMD(eV.fechaInicio) : null
                const fechaFinalizacion = eV.fechaFinalizacion ? toYMD(eV.fechaFinalizacion) : null
                const fechaCumplimiento = eV.fechaCumplimiento ? toYMD(eV.fechaCumplimiento) : null

                const endForElapsed = fechaCumplimiento || fechaFinalizacion
                const businessDaysOfStage = listBusinessDaysInclusive(fechaInicio, endForElapsed)

                for (const ymd of businessDaysOfStage) {
                    if (!coveredBusinessDays.has(ymd)) coveredBusinessDays.add(ymd)
                }
            }

            const totalDiasHabilesUnicos = coveredBusinessDays.size

            updates.push(
                prisma.vacante.update({
                    where: { id: vac.id },
                    data: { diasHabilesFinalizacion: totalDiasHabilesUnicos },
                })
            )
        }

        // 4) Aplicar en una transacción
        await prisma.$transaction(updates)

        return { updated: updates.length, total: vacantes.length }
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Backfill días hábiles finalización' })
    }
}

const run = () => {
    nodeCron.schedule('*/5 * * * *', async () => {
        console.log(`[INFO] ${dayjs().format('YYYY-MM-DD HH:mm:ss')} Tarea iniciada`)
        const vacantesActualizadas = await backfillDiasHabilesFinalizacionPendientes()
        console.log(vacantesActualizadas)
        console.log(`[INFO] ${dayjs().format('YYYY-MM-DD HH:mm:ss')} Tarea finalizada`)
    })
}

export const CronService = {
    run
}