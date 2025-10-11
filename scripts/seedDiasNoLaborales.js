// seedDiasNoLaborales.js (ESM)
import { prisma } from '../src/prismaClient.js'
import fs from 'fs'
import path from 'path'
import process from 'process'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

// Ajustá estos IDs a tu empresa/proceso
const empresaId = '8b53461a-a79d-478a-902f-a95ba46137e6'
const procesoId = '2095b78e-3384-47d5-ad57-6df3a5ae4147'

function toDateOnlyUTC(dateStr) {
  if (!dateStr) return null
  const d = dayjs.utc(dateStr, 'YYYY-MM-DD', true)
  if (!d.isValid()) return null
  return d.startOf('day').toDate()
}

function sameDayUTC(a, b) {
  return dayjs.utc(a).isSame(dayjs.utc(b), 'day')
}

async function ensureDiaNoLaboral({ empresaId, nombre, fechaYMD }) {
  const fecha = toDateOnlyUTC(fechaYMD)
  if (!fecha) throw new Error(`Fecha inválida en feriado "${nombre}": ${fechaYMD}`)

  // Buscamos por empresa + fecha (lo más lógico como clave de unicidad para feriados)
  const existing = await prisma.diaNoLaboral.findFirst({
    where: {
      empresaId,
      fecha,
    },
    select: { id: true, nombre: true },
  })

  if (existing) {
    // Si existe pero tiene nombre distinto, lo dejamos como está (podrías actualizar si querés)
    return existing.id
  }

  const created = await prisma.diaNoLaboral.create({
    data: {
      empresaId,
      nombre: nombre?.toString().trim() || dayjs.utc(fecha).format('YYYY-MM-DD'),
      fecha,
      uc: 'seed', // auditoría opcional
      tipo: 'nacional', // descomenta si tu enum/columna existe y querés setearlo
    },
    select: { id: true },
  })
  return created.id
}

async function cargarFeriados(feriados) {
  const ids = []
  for (const f of feriados) {
    const id = await ensureDiaNoLaboral({
      empresaId,
      nombre: f.Nombre,
      fechaYMD: f.fecha,
    })
    ids.push({ ...f, id })
  }
  return ids
}

async function getVacantesConRango() {
  // 1) Traer vacantes del proceso
  const vacantes = await prisma.vacante.findMany({
    where: { empresaId, procesoId, activo: true },
    select: { id: true, fechaInicio: true },
  })
  if (!vacantes.length) return []

  // 2) Buscar todas las fechas de cumplimiento de sus etapas, y quedarnos con el MAX por vacante
  const vacanteIds = vacantes.map(v => v.id)

  const etapas = await prisma.vacanteEtapa.findMany({
    where: { vacanteId: { in: vacanteIds } },
    select: { vacanteId: true, fechaCumplimiento: true },
  })

  const maxCumplPorVacante = new Map()
  for (const e of etapas) {
    if (!e.fechaCumplimiento) continue
    const prev = maxCumplPorVacante.get(e.vacanteId)
    if (!prev || dayjs.utc(e.fechaCumplimiento).isAfter(dayjs.utc(prev))) {
      maxCumplPorVacante.set(e.vacanteId, e.fechaCumplimiento)
    }
  }

  // 3) Armar objetos {id, inicio, fin|null}
  return vacantes.map(v => ({
    id: v.id,
    inicio: v.fechaInicio,                          // Date
    fin: maxCumplPorVacante.get(v.id) ?? null,      // Date | null (si null, se considera 'abierta/continúa')
  }))
}

function feriadoAfectaVacante(feriadoDate, inicio, fin) {
  const f = dayjs.utc(feriadoDate)
  const start = dayjs.utc(inicio)

  // Si no tiene fin (sin etapas cumplidas), consideramos desde inicio en adelante
  if (!fin) {
    return !f.isBefore(start, 'day') // f >= inicio
  }

  const end = dayjs.utc(fin)
  return (!f.isBefore(start, 'day') && !f.isAfter(end, 'day')) // inicio <= f <= fin
}

async function relacionarFeriadosConVacantes(feriadosConId, vacantesConRango) {
  const pairs = []

  for (const f of feriadosConId) {
    const feriadoDate = toDateOnlyUTC(f.fecha) // Date (00:00 UTC)
    for (const v of vacantesConRango) {
      if (feriadoAfectaVacante(feriadoDate, v.inicio, v.fin)) {
        pairs.push({ vacanteId: v.id, diaNoLaboralId: f.id })
      }
    }
  }

  if (!pairs.length) return { created: 0 }

  // createMany con skipDuplicates (tu tabla tiene índice por [vacanteId, diaNoLaboralId])
  const res = await prisma.vacanteDiaNoLaboral.createMany({
    data: pairs.map(p => ({ ...p, uc: 'seed' })),
    skipDuplicates: true,
  })
  return { created: res.count }
}

async function main() {
  const inputPath = process.argv[2] || './scripts/feriados.json'
  const abs = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(abs)) {
    throw new Error(`No se encontró el archivo de feriados: ${abs}`)
  }

  const feriados = JSON.parse(fs.readFileSync(abs, 'utf-8'))
  if (!Array.isArray(feriados)) {
    throw new Error('El archivo debe contener un array de feriados { Nombre, fecha }')
  }

  // 1) Insertar (o recuperar) feriados (DiaNoLaboral)
  const feriadosConId = await cargarFeriados(feriados)

  // 2) Obtener vacantes y su rango [fechaInicio, max(fechaCumplimiento)]
  const vacantesConRango = await getVacantesConRango()

  // 3) Relacionar
  const { created } = await relacionarFeriadosConVacantes(feriadosConId, vacantesConRango)

  console.log(`✅ Feriados procesados: ${feriadosConId.length}`)
  console.log(`✅ Vacantes consideradas: ${vacantesConRango.length}`)
  console.log(`✅ Relaciones creadas (nuevas): ${created}`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
