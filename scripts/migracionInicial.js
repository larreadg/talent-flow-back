import { prisma } from '../src/prismaClient.js'
import fs from 'fs'
import path from 'path'
import process from 'process'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

const empresaId = '93c01d04-0164-4a73-b9d8-05b427d2bf19'
const procesoId = '249120e6-b84c-4d7c-b517-eac95fa43776'

// Enums mapeados a tu schema
const ESTADO_VACANTE = {
    abierta: 'abierta',
    pausada: 'pausada',
    finalizada: 'finalizada',
    cancelada: 'cancelada',
}

const ESTADO_ETAPA = {
    abierta: 'abierta',
    pendiente: 'pendiente',
    finalizada: 'finalizada',
}

function normalizeKey(s) {
    return (s ?? '').toString().normalize('NFKC').trim().toLowerCase()
}

function toDateOnlyUTC(dateStr) {
    if (!dateStr) return null
    const d = dayjs.utc(dateStr, 'YYYY-MM-DD', true)
    if (!d.isValid()) return null
    return d.startOf('day').toDate()
}

// ====================== helpers catálogo ======================
async function ensureDepartamento({ empresaId, nombre, uc = 'seed' }) {
    const nombreTrim = (nombre ?? '').toString().trim()
    if (!nombreTrim) throw new Error('Departamento sin nombre')

    const existing = await prisma.departamento.findFirst({
        where: { empresaId, nombre: { equals: nombreTrim, mode: 'insensitive' } },
        select: { id: true },
    })
    if (existing) return existing.id

    const created = await prisma.departamento.create({
        data: { empresaId, nombre: nombreTrim, uc },
        select: { id: true },
    })
    return created.id
}

async function getSedeIdOrFail({ empresaId, nombre }) {
    const nombreTrim = (nombre ?? '').toString().trim()
    if (!nombreTrim) throw new Error('Sede sin nombre')

    const sede = await prisma.sede.findFirst({
        where: { empresaId, nombre: { equals: nombreTrim, mode: 'insensitive' } },
        select: { id: true },
    })
    if (!sede) throw new Error(`Sede no encontrada: "${nombreTrim}" (empresaId=${empresaId})`)
    return sede.id
}

// ====================== proceso/etapas ======================
async function getProcesoEtapaMap(procesoId) {
    const list = await prisma.procesoEtapa.findMany({
        where: { procesoId },
        include: { etapa: { select: { nombre: true } } },
        orderBy: { orden: 'asc' },
    })
    // Map por nombre de etapa (case-insensitive) -> { id, orden }
    const map = new Map()
    for (const pe of list) {
        map.set(normalizeKey(pe.etapa.nombre), { id: pe.id, orden: pe.orden })
    }
    return map
}

// ====================== vacante (find-or-create) ======================
async function findOrCreateVacante({ v, departamentoId, sedeId }) {
    const nombre = (v.vacante ?? '').toString().trim()
    const fechaInicioStr = v.fecheInicio || v.fechaInicio
    const fechaInicio = toDateOnlyUTC(fechaInicioStr)
    if (!fechaInicio) throw new Error(`Fecha de inicio inválida para "${nombre}"`)

    const estadoIn = normalizeKey(v.estado)
    const estado = ESTADO_VACANTE[estadoIn] || ESTADO_VACANTE.abierta

    // Intentamos encontrar por la combinación que replica tu @@unique
    const existing = await prisma.vacante.findFirst({
        where: {
            empresaId, procesoId, nombre,
            fechaInicio,
            departamentoId, sedeId,
            estado,
        },
        select: { id: true },
    })

    if (existing) return { id: existing.id, estado }

    const created = await prisma.vacante.create({
        data: {
            empresaId,
            procesoId,
            nombre,
            fechaInicio,
            departamentoId,
            sedeId,
            estado,
            aumentoDotacion: false,
            recursos: v.recursos ?? null,
            uc: 'seed',
        },
        select: { id: true },
    })
    return { id: created.id, estado }
}

// ====================== calcular estado de etapa ======================
function estadoEtapaParaVacante(vacanteEstado, fechaCumplimientoStr) {
    const estadoVac = (vacanteEstado ?? '').toString().trim().toLowerCase()

    if (estadoVac === ESTADO_VACANTE.cancelada || estadoVac === ESTADO_VACANTE.finalizada) {
        return ESTADO_ETAPA.finalizada
    }

    // Regla indicada para "abierta" (y aplicable también si estuviera pausada)
    const hasCumpl = !!toDateOnlyUTC(fechaCumplimientoStr)
    return hasCumpl ? ESTADO_ETAPA.finalizada : ESTADO_ETAPA.abierta
}

// ====================== insertar/actualizar etapas ======================
async function upsertEtapasParaVacante({ vacanteId, vacanteEstado, etapasJSON, procesoEtapaMap }) {
    const errores = []

    for (const e of etapasJSON ?? []) {
        const nombreEtapa = (e?.nombre ?? '').toString().trim()
        if (!nombreEtapa) continue

        const pe = procesoEtapaMap.get(normalizeKey(nombreEtapa))
        if (!pe) {
            errores.push(`No existe ProcesoEtapa para "${nombreEtapa}"`)
            continue
        }

        const fechaInicio = toDateOnlyUTC(e.fechaInicio)
        const fechaFinalizacion = toDateOnlyUTC(e.fechaFinalizacion)
        const fechaCumplimiento = toDateOnlyUTC(e.fechaCumplimiento)

        const estado = estadoEtapaParaVacante(vacanteEstado, e.fechaCumplimiento)

        // Existe?
        const existing = await prisma.vacanteEtapa.findFirst({
            where: { vacanteId, procesoEtapaId: pe.id },
            select: { id: true },
        })

        if (existing) {
            await prisma.vacanteEtapa.update({
                where: { id: existing.id },
                data: {
                    fechaInicio,
                    fechaFinalizacion,
                    fechaCumplimiento,
                    estado,
                    um: 'seed',
                },
            })
        } else {
            await prisma.vacanteEtapa.create({
                data: {
                    vacanteId,
                    procesoEtapaId: pe.id,
                    fechaInicio,
                    fechaFinalizacion,
                    fechaCumplimiento,
                    estado,
                    uc: 'seed',
                },
            })
        }
    }

    return { errores }
}

// ====================== flujo principal ======================
async function crearVacantesYEtapas({ vacantes }) {
    const procesoEtapaMap = await getProcesoEtapaMap(procesoId)

    const erroresGlobales = []
    let countVacantes = 0
    let countEtapas = 0

    for (const v of vacantes) {
        try {
            const areaStr = (v.area ?? '').toString().trim()
            const sedeStr = (v.sede ?? '').toString().trim()

            const [departamentoId, sedeId] = await Promise.all([
                ensureDepartamento({ empresaId, nombre: areaStr, uc: 'seed' }),
                getSedeIdOrFail({ empresaId, nombre: sedeStr }),
            ])

            // Vacante
            const { id: vacanteId, estado: vacanteEstado } = await findOrCreateVacante({
                v, departamentoId, sedeId,
            })
            countVacantes++

            // Etapas
            const { errores } = await upsertEtapasParaVacante({
                vacanteId,
                vacanteEstado,
                etapasJSON: v.etapas,
                procesoEtapaMap,
            })

            if (errores.length) {
                erroresGlobales.push({ vacante: v.vacante, errores })
            } else {
                // contar etapas procesadas (hasta 8 si vienen completas)
                countEtapas += (v.etapas?.length || 0)
            }
        } catch (e) {
            erroresGlobales.push({ vacante: v?.vacante, error: e.message })
        }
    }

    return { countVacantes, countEtapas, erroresGlobales }
}

async function main() {
    const inputPath = './scripts/data.json'
    const abs = path.resolve(process.cwd(), inputPath)
    if (!fs.existsSync(abs)) throw new Error(`No se encontró: ${abs}`)

    const vacantes = JSON.parse(fs.readFileSync(abs, 'utf-8'))
    if (!Array.isArray(vacantes)) throw new Error('El JSON debe ser un array de vacantes')

    const { countVacantes, countEtapas, erroresGlobales } = await crearVacantesYEtapas({ vacantes })

    console.log(`✅ Vacantes procesadas: ${countVacantes}`)
    console.log(`✅ Etapas procesadas:   ${countEtapas}`)
    if (erroresGlobales.length) {
        console.warn('⚠️ Errores:')
        for (const e of erroresGlobales) console.warn(' - ', e)
    }
}

main()
    .catch((e) => {
        console.error('Seed error:', e)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })