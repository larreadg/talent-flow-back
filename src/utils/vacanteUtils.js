import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import { TalentFlowError } from './error.js'
import { Prisma } from '@prisma/client'
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
export function toDateOnly(value, field = 'fechaInicio') {
  const d = dayjs.utc(value)
  if (!d.isValid()) throw new TalentFlowError(`${field} inválida. Usar formato YYYY-MM-DD.`, 400)
  // conservar solo la parte de fecha
  return new Date(d.format('YYYY-MM-DD') + 'T00:00:00.000Z')
}

export function buildOrderBy(sortBy, sortDir) {
  const dir = sortDir === 'desc' ? 'desc' : 'asc';

  // Whitelist por seguridad (evita sort arbitrario)
  const allowed = [
    'nombre',
    'fechaInicio',
    'estado',
    'departamento.nombre',
    'sede.nombre',
  ];

  if (!allowed.includes(sortBy)) return { nombre: 'asc' };

  const parts = String(sortBy).split('.');

  // Campo simple
  if (parts.length === 1) {
    return { [parts[0]]: dir };
  }

  // Relación.nestedField (1 nivel)
  if (parts.length === 2) {
    const [rel, field] = parts;
    return { [rel]: { [field]: dir } };
  }

  // Si algún día querés más niveles, extender acá.
  return { nombre: 'asc' };
}

export const STATES = ['abierta', 'pausada', 'finalizada', 'cancelada'];

/**
 * Normaliza un parámetro que puede venir como:
 * - array de strings: ["a","b"]
 * - string csv: "a,b,c"
 * - null/undefined
 * Retorna siempre string[] sin vacíos ni espacios.
 */
export function normalizeList(input) {
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}


/**
 * YYYY-MM-DD (UTC) para Date o string/number parseable por Date.
 * @param {Date|string|number|null|undefined} d
 * @returns {string|null}
 */
export const toYMD = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/**
 * Crea Date UTC de medianoche desde YYYY-MM-DD.
 * @param {string} s - 'YYYY-MM-DD'
 * @returns {Date}
 */
export const fromYMD = (s) => new Date(`${s}T00:00:00.000Z`);

/**
 * Suma días en UTC (sin desbordes locales).
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export const addDaysUTC = (date, days) => {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

/**
 * YYYY-MM-DD (UTC) del “hoy” actual.
 * @returns {string}
 */
export const todayYMD = () => toYMD(new Date());

/** -----------------------------------------
 * Feriados: construcción de estructuras
 * ----------------------------------------- */

/**
 * Construye un Set<string> de YYYY-MM-DD desde:
 *  - Array<Date|string|number|{fecha:any}>
 *  - o directamente un Set<string> ya normalizado
 * @param {Array<any>|Set<string>} datesOrSet
 * @returns {Set<string>}
 */
export const buildHolidaySet = (datesOrSet) => {
  if (!datesOrSet) return new Set();
  if (datesOrSet instanceof Set) return datesOrSet;
  const out = new Set();
  for (const x of datesOrSet) {
    // admite objetos tipo { fecha: ... }
    const raw = x && typeof x === 'object' && 'fecha' in x ? x.fecha : x;
    const ymd = toYMD(raw);
    if (ymd) out.add(ymd);
  }
  return out;
};

/**
 * Construye Set de feriados desde una vacante que tenga
 * vacante.diasNoLaborales[].diaNoLaboral.fecha
 * @param {object} vacante
 * @returns {Set<string>}
 */
export const buildHolidaySetFromVacante = (vacante) => {
  const list =
    vacante?.diasNoLaborales?.map((vdl) => vdl?.diaNoLaboral?.fecha).filter(Boolean) ?? [];
  return buildHolidaySet(list);
};

/** ----------------------------
 * Núcleo de días hábiles (UTC)
 * ---------------------------- */

/**
 * ¿Es día hábil? (no sábado/domingo, no feriado)
 * @param {Date} date
 * @param {Set<string>} holidaySet - Set de 'YYYY-MM-DD'
 * @returns {boolean}
 */
export const isWorkingDay = (date, holidaySet = new Set()) => {
  const ymd = toYMD(date);
  const dow = date.getUTCDay(); // 0=Domingo, 6=Sábado
  if (dow === 0 || dow === 6) return false;
  if (holidaySet.has(ymd)) return false;
  return true;
};

/**
 * Cuenta días hábiles INCLUSIVOS entre startStr y endStr (YYYY-MM-DD).
 * @param {string|null|undefined} startStr
 * @param {string|null|undefined} endStr
 * @param {Set<string>} holidaySet
 * @returns {number}
 */
export const countBusinessDaysInclusive = (startStr, endStr, holidaySet = new Set()) => {
  if (!startStr || !endStr) return 0;
  let start = fromYMD(startStr);
  const end = fromYMD(endStr);
  if (start > end) return 0;

  let count = 0;
  while (start <= end) {
    if (isWorkingDay(start, holidaySet)) count++;
    start = addDaysUTC(start, 1);
  }
  return count;
};

/**
 * Lista días hábiles (YYYY-MM-DD) entre start y end INCLUSIVO.
 * @param {string|null|undefined} startStr
 * @param {string|null|undefined} endStr
 * @param {Set<string>} holidaySet
 * @returns {string[]}
 */
export const listBusinessDaysInclusive = (startStr, endStr, holidaySet = new Set()) => {
  const out = [];
  if (!startStr || !endStr) return out;
  let cur = fromYMD(startStr);
  const end = fromYMD(endStr);
  if (cur > end) return out;
  while (cur <= end) {
    if (isWorkingDay(cur, holidaySet)) out.push(toYMD(cur));
    cur = addDaysUTC(cur, 1);
  }
  return out;
};

/**
 * Lista días hábiles desde el día siguiente a 'fromStr' hasta 'toStr' INCLUSIVO.
 * @param {string|null|undefined} fromStr
 * @param {string|null|undefined} toStr
 * @param {Set<string>} holidaySet
 * @returns {string[]}
 */
export const listBusinessDaysAfterDate = (fromStr, toStr, holidaySet = new Set()) => {
  const out = [];
  if (!fromStr || !toStr) return out;
  let cur = addDaysUTC(fromYMD(fromStr), 1);
  const end = fromYMD(toStr);
  if (cur > end) return out;
  while (cur <= end) {
    if (isWorkingDay(cur, holidaySet)) out.push(toYMD(cur));
    cur = addDaysUTC(cur, 1);
  }
  return out;
};

/**
 * Crea un set de helpers ya “bindeados” a un feriado específico.
 * @param {Array<any>|Set<string>} holidayDatesOrSet
 */
export const makeBusinessDayHelpers = (holidayDatesOrSet) => {
  const holidaySet = buildHolidaySet(holidayDatesOrSet);
  return {
    holidaySet,
    toYMD,
    fromYMD,
    addDaysUTC,
    todayYMD,
    isWorkingDay: (date) => isWorkingDay(date, holidaySet),
    countBusinessDaysInclusive: (a, b) => countBusinessDaysInclusive(a, b, holidaySet),
    listBusinessDaysInclusive: (a, b) => listBusinessDaysInclusive(a, b, holidaySet),
    listBusinessDaysAfterDate: (a, b) => listBusinessDaysAfterDate(a, b, holidaySet),
  };
};


export const ORDER_MAP = {
  nombre: Prisma.sql`nombre`,
  fecha_inicio: Prisma.sql`fecha_inicio`,
  dias_transcurridos_hoy: Prisma.sql`dias_transcurridos_hoy`,
  dias_transcurridos_finalizacion: Prisma.sql`dias_transcurridos_finalizacion`,
  progreso_pct: Prisma.sql`progreso_pct`,
  etapas_finalizadas: Prisma.sql`etapas_finalizadas`,
  etapas_totales: Prisma.sql`etapas_totales`,
  sede: Prisma.sql`sede`,
  area_solicitante: Prisma.sql`area_solicitante`,
}

// Helpers para arrays tipados en ANY(...)
export const sqlArrayText = (arr) => {
  const values = arr.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')
  return Prisma.raw(`ARRAY[${values}]::text[]`)
}

export const sqlArrayUUID = (arr) => {
  const values = arr.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')
  return Prisma.raw(`ARRAY[${values}]::uuid[]`)
}

export function normList(value) {
  if (!value) return null
  if (Array.isArray(value)) return value.filter(v => v != null && v !== '')
  if (typeof value === 'string') {
      // Si contiene comas, dividir el string
      const items = value.split(',').map(v => v.trim()).filter(v => v !== '')
      return items.length > 0 ? items : null
  }
  return null
}

// 👇 Helpers para excluir feriados de ESTA vacante
const filterOutHolidays = (days, holidaySet) => days.filter((d) => !holidaySet.has(d)); // 👈 NEW

// Lista de días hábiles (lu–vi) entre [start, end] EXCLUYENDO feriados de la vacante  👈 NEW
export const businessDaysExclHolidays = (start, end, holidaySet) => {
  if (!start || !end) return [];
  return filterOutHolidays(listBusinessDaysInclusive(start, end), holidaySet);
};

// Lista de días hábiles STRICTAMENTE posteriores a fromDateExclusive hasta toDateInclusive  👈 NEW
export const businessDaysAfterExclHolidays = (fromDateExclusive, toDateInclusive, holidaySet) => {
  if (!fromDateExclusive || !toDateInclusive) return [];
  return filterOutHolidays(listBusinessDaysAfterDate(fromDateExclusive, toDateInclusive), holidaySet);
};