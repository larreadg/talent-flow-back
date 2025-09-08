import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)
/**
 * Helpers
 */
export function isWeekend(d) {
    const w = dayjs(d).day() // 0=Sun, 6=Sat
    return w === 0 || w === 6
}

/**
 * Suma "n" días hábiles (incluyendo la fecha de inicio como día 1 si es hábil).
 * - Si start cae en no hábil, mueve el inicio al próximo hábil (y ese pasa a ser el día 1).
 * - Devuelve { start: fechaInicioHabil, end: fechaFinHabil, skippedHolidayKeys: Set<'YYYY-MM-DD'> }
 */
export function addBusinessDaysInclusive(start, n, holidaySet) {
    let cur = dayjs.utc(start)
    const skippedHolidayKeys = new Set()

    // Mover inicio a próximo hábil si hace falta
    while (isWeekend(cur) || holidaySet.has(cur.format('YYYY-MM-DD'))) {
        if (holidaySet.has(cur.format('YYYY-MM-DD'))) {
            skippedHolidayKeys.add(cur.format('YYYY-MM-DD'))
        }
        cur = cur.add(1, 'day')
    }
    const startHabil = cur

    // Contar días hábiles (startHabil cuenta como día 1)
    let counted = 1
    let end = startHabil
    while (counted < n) {
        end = end.add(1, 'day')
        if (isWeekend(end)) continue
        const key = end.format('YYYY-MM-DD')
        if (holidaySet.has(key)) {
            skippedHolidayKeys.add(key)
            continue
        }
        counted += 1
    }

    return { start: startHabil, end, skippedHolidayKeys }
}

/**
 * Normaliza una fecha (string | Date) a Date-only (UTC 00:00) para @db.Date
 */
export function toDateOnly(value) {
    const d = dayjs.utc(value)
    if (!d.isValid()) throw new TalentFlowError('fechaInicio inválida. Usar formato YYYY-MM-DD.', 400)
    // conservar solo la parte de fecha
    return new Date(d.format('YYYY-MM-DD') + 'T00:00:00.000Z')
}