import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { toDateOnly, addBusinessDaysInclusive, buildOrderBy, STATES, normalizeList } from '../utils/vacanteUtils.js'
import { pick } from '../utils/utils.js'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import utc from 'dayjs/plugin/utc.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
dayjs.extend(utc)
dayjs.extend(localizedFormat)
dayjs.locale('es')

const PATCH_ALLOWED = ['nombre', 'departamentoId', 'sedeId', 'fechaInicio', 'estado', 'aumentoDotacion', 'resultado', 'fechaIngreso', 'fechaConfirmacion']

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
async function getByEmpresa({
    limit = 10,
    offset = 0,
    filter = null,
    sortBy = 'nombre',
    sortDir = 'asc',
    estados = null,
    departamentos = null,
    sedes = null,
} = {}) {
    try {
        const currentUser = getCurrentUser();

        // Normalización de paginación y texto
        const take = Number.isInteger(limit) && limit > 0 ? limit : 10;
        const skip = Number.isInteger(offset) && offset >= 0 ? offset : 0;
        const text = (typeof filter === 'string' && filter.trim()) ? filter.trim() : null;

        // Normalización de filtros (acepta csv o arrays)
        const estadosListAll = normalizeList(estados).map(s => s.toLowerCase());
        // Validar contra el enum/constante STATES (en minúsculas para comparar)
        const STATES_LC = STATES.map(s => s.toLowerCase());
        const estadosList = estadosListAll.filter(s => STATES_LC.includes(s));

        const departamentosList = normalizeList(departamentos);
        const sedesList = normalizeList(sedes);

        // WHERE base
        const baseWhere = {
            empresaId: currentUser.empresaId,
            activo: true,
        };

        // Búsqueda por texto: permite matchear por nombre/relaciones y por estado parcial
        const lc = text?.toLowerCase() ?? '';
        const matchedStatesFromText = lc
            ? STATES.filter(s => s.toLowerCase().includes(lc)) // permite "abier", "CERRA", etc.
            : [];

        // Construimos el AND principal y metemos el OR del texto (si hay)
        const and = [baseWhere];

        if (estadosList.length) {
            // Prisma compara respetando el enum definido; usamos los valores originales de STATES
            // Mapear de lc -> valor exacto del enum en STATES
            const estadosExact = estadosList
                .map(lcVal => STATES.find(s => s.toLowerCase() === lcVal))
                .filter(Boolean);
            if (estadosExact.length) and.push({ estado: { in: estadosExact } });
        }

        if (departamentosList.length) {
            and.push({ departamentoId: { in: departamentosList } });
        }

        if (sedesList.length) {
            and.push({ sedeId: { in: sedesList } });
        }

        if (text) {
            and.push({
                OR: [
                    ...(matchedStatesFromText.length ? [{ estado: { in: matchedStatesFromText } }] : []), // Vacante.estado (enum)
                    { nombre: { contains: text, mode: 'insensitive' } }, // Vacante.nombre
                    { departamento: { nombre: { contains: text, mode: 'insensitive' } } }, // Departamento.nombre
                    { sede: { nombre: { contains: text, mode: 'insensitive' } } }, // Sede.nombre
                ],
            });
        }

        const where = and.length > 1 ? { AND: and } : baseWhere;

        // Total para meta
        const total = await prisma.vacante.count({ where });

        const orderBy = buildOrderBy(sortBy, sortDir);

        const vacantes = await prisma.vacante.findMany({
            where,
            orderBy,
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
                // Días no laborales que afectan a la vacante
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
        });

        return {
            data: vacantes.map((el) => {
                const total = el.etapasVacante.length;
                const finalizadas = el.etapasVacante.reduce(
                    (acc, ev) => acc + (ev.estado === 'finalizada' ? 1 : 0),
                    0
                );

                // porcentaje 0..100 con 2 decimales (número)
                const progress = total ? Number(((finalizadas / total) * 100).toFixed(2)) : 0;

                return {
                    ...el,
                    fechaInicio: el.fechaInicio ? el.fechaInicio.toISOString().slice(0, 10) : null,
                    progress,                         // ej: 66.67
                    progressLabel: `${progress}%`,    // ej: "66.67%"
                };
            }),
            meta: {
                total,
                limit: take,
                offset: skip,
                returned: vacantes.length,
                hasMore: skip + vacantes.length < total,
            },
        };
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Vacante' });
    }
}

/**
 * Obtener vacante + fechas no seleccionables + métricas hábiles
 *
 * @param {string} id UUID de la vacante.
 * @returns {Promise<{data: Vacante & { disabledDates: string[] }, meta: any}>}
 */
async function getById(id) {
    try {
        const currentUser = getCurrentUser();

        /** Cargar vacante + relaciones necesarias */
        let vacante = await prisma.vacante.findFirst({
            where: { id, empresaId: currentUser.empresaId, estado: { in: ['abierta', 'finalizada', 'pausada', 'cancelada'] } },
            include: {
                proceso: { select: { nombre: true } },
                departamento: { select: { nombre: true } },
                sede: { select: { nombre: true } },
                etapasVacante: {
                    orderBy: { procesoEtapa: { orden: "asc" } },
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
                    orderBy: { diaNoLaboral: { fecha: "asc" } },
                    include: {
                        diaNoLaboral: { select: { id: true, nombre: true, fecha: true, tipo: true } },
                    },
                },
            },
        });

        if (vacante === null) {
            throw new TalentFlowError(`La vacante ${id} no existe`, 404);
        }

        /** ----------------------------
         * Helpers de fechas hábiles
         * ---------------------------- */
        const toYMD = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
        const fromYMD = (s) => new Date(s + "T00:00:00.000Z");
        const addDaysUTC = (date, days) => {
            const d = new Date(date.getTime());
            d.setUTCDate(d.getUTCDate() + days);
            return d;
        };

        // Set de feriados asociados a la vacante
        const holidaySet = new Set(
            (vacante.diasNoLaborales ?? []).map((vdl) => toYMD(vdl.diaNoLaboral.fecha))
        );

        const isWorkingDay = (date) => {
            const ymd = toYMD(date);
            const dow = date.getUTCDay(); // 0=Dom, 6=Sáb
            if (dow === 0 || dow === 6) return false;
            if (holidaySet.has(ymd)) return false;
            return true;
        };

        // Cuenta días hábiles INCLUSIVOS entre startStr y endStr (YYYY-MM-DD).
        const countBusinessDaysInclusive = (startStr, endStr) => {
            if (!startStr || !endStr) return 0;
            let start = fromYMD(startStr);
            const end = fromYMD(endStr);
            if (start > end) return 0;

            let count = 0;
            while (start <= end) {
                if (isWorkingDay(start)) count++;
                start = addDaysUTC(start, 1);
            }
            return count;
        };

        // Lista de días hábiles (YYYY-MM-DD) entre start y end INCLUSIVO
        const listBusinessDaysInclusive = (startStr, endStr) => {
            const out = [];
            if (!startStr || !endStr) return out;
            let cur = fromYMD(startStr);
            const end = fromYMD(endStr);
            if (cur > end) return out;
            while (cur <= end) {
                if (isWorkingDay(cur)) out.push(toYMD(cur));
                cur = addDaysUTC(cur, 1);
            }
            return out;
        };

        // Lista de días hábiles desde el día siguiente a 'fromStr' hasta 'toStr' inclusive
        const listBusinessDaysAfterDate = (fromStr, toStr) => {
            const out = [];
            if (!fromStr || !toStr) return out;
            let cur = addDaysUTC(fromYMD(fromStr), 1);
            const end = fromYMD(toStr);
            if (cur > end) return out;
            while (cur <= end) {
                if (isWorkingDay(cur)) out.push(toYMD(cur));
                cur = addDaysUTC(cur, 1);
            }
            return out;
        };

        /** ----------------------------
         * Construcción de disabledDates
         * ---------------------------- */
        const etapas = vacante.etapasVacante ?? [];

        // primera etapa con fechaInicio definida
        const primeraConInicio = etapas.find((e) => e.fechaInicio);
        const startDateStr = primeraConInicio ? toYMD(primeraConInicio.fechaInicio) : null;

        // última etapa “conocida” (fechaCumplimiento || fechaFinalizacion)
        const ultima = [...etapas].reverse().find((e) => e.fechaCumplimiento || e.fechaFinalizacion);
        const endDateStr = ultima
            ? toYMD(ultima.fechaCumplimiento || ultima.fechaFinalizacion)
            : null;

        // Fines de semana dentro del rango
        const disabledWeekends = new Set();
        if (startDateStr && endDateStr) {
            let cursor = fromYMD(startDateStr);
            const end = fromYMD(endDateStr);
            while (cursor <= end) {
                const dow = cursor.getUTCDay();
                if (dow === 0 || dow === 6) disabledWeekends.add(toYMD(cursor));
                cursor = addDaysUTC(cursor, 1);
            }
        }

        // Feriados asociados
        const disabledHolidays = new Set(holidaySet);

        // Unión
        const disabledDates = Array.from(new Set([...disabledWeekends, ...disabledHolidays])).sort();

        /** -----------------------------------
         * Normalización + métricas por etapa
         * ----------------------------------- */
        vacante.fechaInicio = vacante.fechaInicio ? toYMD(vacante.fechaInicio) : null;
        vacante.fechaConfirmacion = vacante.fechaConfirmacion ? toYMD(vacante.fechaConfirmacion) : null;
        vacante.fechaIngreso = vacante.fechaIngreso ? toYMD(vacante.fechaIngreso) : null;

        // Sets globales para días únicos
        const coveredBusinessDays = new Set();
        const coveredDelayDays = new Set();

        vacante.etapasVacante.forEach((eV) => {
            eV.fechaInicio = eV.fechaInicio ? toYMD(eV.fechaInicio) : null;
            eV.fechaFinalizacion = eV.fechaFinalizacion ? toYMD(eV.fechaFinalizacion) : null;
            eV.fechaCumplimiento = eV.fechaCumplimiento ? toYMD(eV.fechaCumplimiento) : null;

            // Etiquetas legibles
            eV.fechaInicioLabel = eV.fechaInicio
                ? dayjs(eV.fechaInicio).format("ddd, DD [de] MMM [de] YYYY")
                : null;
            eV.fechaFinalizacionLabel = eV.fechaFinalizacion
                ? dayjs(eV.fechaFinalizacion).format("ddd, DD [de] MMM [de] YYYY")
                : null;
            eV.fechaCumplimientoLabel = eV.fechaCumplimiento
                ? dayjs(eV.fechaCumplimiento).format("ddd, DD [de] MMM [de] YYYY")
                : null;

            // ---- Métricas hábiles por etapa ----
            const totalDiasReal = eV.fechaInicio && eV.fechaCumplimiento
                ? countBusinessDaysInclusive(eV.fechaInicio, eV.fechaCumplimiento)
                : 0;

            const totalDiasPlan = eV.fechaInicio && eV.fechaFinalizacion
                ? countBusinessDaysInclusive(eV.fechaInicio, eV.fechaFinalizacion)
                : 0;

            eV.totalDias = totalDiasReal || totalDiasPlan || 0;

            // Retraso hábil (si cumplió después del plan)
            let retraso = 0;
            if (eV.fechaCumplimiento && eV.fechaFinalizacion) {
                if (fromYMD(eV.fechaCumplimiento) > fromYMD(eV.fechaFinalizacion)) {
                    const delayDays = listBusinessDaysAfterDate(eV.fechaFinalizacion, eV.fechaCumplimiento);
                    retraso = delayDays.length;
                    // Agregar al set global de retrasos únicos
                    delayDays.forEach((d) => coveredDelayDays.add(d));
                }
            }
            eV.totalRetrasoDias = retraso;

            // ---- Contribución de días hábiles ÚNICOS por etapa ----
            const endForElapsed = eV.fechaCumplimiento || eV.fechaFinalizacion;
            const businessDaysOfStage = listBusinessDaysInclusive(eV.fechaInicio, endForElapsed);

            let contributes = 0;
            for (const ymd of businessDaysOfStage) {
                if (!coveredBusinessDays.has(ymd)) {
                    coveredBusinessDays.add(ymd);
                    contributes++;
                }
            }
            eV.totalDiasUnicosContribuidos = contributes;
        });

        // —— Totales de proceso ——
        const totalDiasSumadoEtapas = (vacante.etapasVacante ?? [])
            .reduce((acc, it) => acc + (Number(it.totalDias) || 0), 0);

        const totalDiasHabilesUnicos = coveredBusinessDays.size;
        const totalDiasRetrasosUnicos = coveredDelayDays.size;

        /** Respuesta */
        return {
            data: {
                ...vacante,
                disabledDates,
            },
            meta: {
                total: 1,
                disabledWeekends: Array.from(disabledWeekends).sort(),
                disabledHolidays: Array.from(disabledHolidays).sort(),
                range: { startDate: startDateStr, endDate: endDateStr },
                // Totales
                totalDiasSumadoEtapas,
                totalDiasHabilesUnicos,
                totalDiasRetrasosUnicos,
            },
        };
    } catch (e) {
        throw mapPrismaError(e, { resource: "Vacante" });
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
 * - aumentoDotacion: boolean
 */
async function post(input) {
    try {
        const currentUser = getCurrentUser()
        const { nombre, procesoId, fechaInicio, departamentoId, sedeId, aumentoDotacion } = input

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
        /** @type {Array<{ procesoEtapaId: string, fechaInicio: Date, fechaFinalizacion: Date, uc: string, um: string, estado: 'abierta'|'pendiente'|'finalizada' }>} */
        const etapasToCreate = []
        const holidayKeysHit = new Set() // fechas feriado que afectaron el cronograma

        for (const [index, item] of plan.entries()) {
            const sla = Number(item.etapa.slaDias)

            const { start, end, skippedHolidayKeys } = addBusinessDaysInclusive(cursor, sla, holidaySet)
            skippedHolidayKeys.forEach(k => holidayKeysHit.add(k))

            etapasToCreate.push({
                procesoEtapaId: item.id,
                fechaInicio: new Date(start.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                fechaFinalizacion: new Date(end.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                uc: currentUser.id,
                um: currentUser.id,
                estado: index === 0 ? 'abierta' : 'pendiente',
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
                    aumentoDotacion
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
                        uc: currentUser.id,
                        um: currentUser.id,
                        estado: e.estado
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
 * @param {boolean} params.aumentoDotacion Si es un aumento de dotacion.
 * @param {'promocion_interna', 'traslado', 'contratacion_externa'} params.resultado Tipo de resultado
 * @returns {Promise<Vacante>}
 */
async function patch(id, input) {
    try {
        const currentUser = getCurrentUser()
        let data = pick(input, PATCH_ALLOWED)

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

        const nextEstado = data.estado
        if (nextEstado) {
            if (current.estado === 'abierta' && !['abierta','pausada','cancelada'].includes(nextEstado)) {
                throw new TalentFlowError('Una vacante abierta solo se puede pausar o cancelar', 400);
            }

            if (current.estado === 'finalizada' && !['finalizada','cancelada'].includes(nextEstado)) {
                throw new TalentFlowError('Una vacante finalizada solo se puede cancelar', 400);
            }

            if (current.estado === 'pausada' && !['pausada','abierta'].includes(nextEstado)) {
                throw new TalentFlowError('Una vacante pausada solo se puede abrir', 400);
            }

            if (current.estado === 'cancelada' && next !== 'cancelada') {
                throw new TalentFlowError('Una vacante cancelada no puede cambiar de estado', 400);
            }
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

        if ('fechaIngreso' in data && data.fechaIngreso !== null) {
            let newFechaIngreso = toDateOnly(data.fechaIngreso, 'fechaIngreso')
            if (dayjs.utc(newFechaIngreso).isBefore(dayjs.utc(current.fechaInicio))) {
                throw new TalentFlowError('fechaIngreso debe ser posterior o igual a la fecha de inicio.', 400)
            }
            data.fechaIngreso = newFechaIngreso
        }
        
        if ('fechaConfirmacion' in data && data.fechaConfirmacion !== null) {
            let newFechaConfirmacion = toDateOnly(data.fechaConfirmacion, 'fechaConfirmacion')
            if (dayjs.utc(newFechaConfirmacion).isBefore(dayjs.utc(current.fechaInicio))) {
                throw new TalentFlowError('fechaConfirmacion debe ser posterior o igual a la fecha de inicio.', 400)
            }
            data.fechaConfirmacion = newFechaConfirmacion
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
                    ...(data.aumentoDotacion !== undefined ? { aumentoDotacion: data.aumentoDotacion } : {}),
                    ...(data.resultado !== undefined ? { resultado: data.resultado } : {}),
                    ...(data.fechaIngreso !== undefined ? { fechaIngreso: data.fechaIngreso } : {}),
                    ...(data.fechaConfirmacion !== undefined ? { fechaConfirmacion: data.fechaConfirmacion } : {}),
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

        for (const [index, item] of plan.entries()) {
            const sla = Number(item.etapa.slaDias) || 0
            const { start, end, skippedHolidayKeys } = addBusinessDaysInclusive(cursor, Math.max(1, sla), holidaySet)
            skippedHolidayKeys.forEach(k => holidayKeysHit.add(k))

            etapasNew.push({
                procesoEtapaId: item.id,
                fechaInicio: new Date(start.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                fechaFinalizacion: new Date(end.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                estado: index === 0 ? 'abierta' : 'pendiente',
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
                    ...(data.fechaIngreso !== undefined ? { fechaIngreso: data.fechaIngreso } : {}),
                    ...(data.fechaConfirmacion !== undefined ? { fechaConfirmacion: data.fechaConfirmacion } : {}),
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
                            estado: e.estado
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

/**
 * GET: Retorna resumen de vacantes agrupadas por estado para la empresa actual.
 *
 * Ejemplo de salida:
 * [
 *   { estado: 'abierta', total: 2 },
 *   { estado: 'cerrada', total: 1 }
 * ]
 */
async function getResumenPorEstado() {
    try {
        const currentUser = getCurrentUser()

        const grouped = await prisma.vacante.groupBy({
            by: ['estado'],
            where: {
                empresaId: currentUser.empresaId,
                activo: true,
            },
            _count: { estado: true },
        })

        // Normalizar el formato
        return grouped.map(g => ({
            estado: g.estado,
            total: g._count.estado,
        }))
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Vacante' })
    }
}

/**
 * Regla clave (invariantes):
 * - No se puede finalizar etapa n si n-1 NO está finalizada.
 * - fechaCumplimiento(n-1) === fechaInicio(n)
 * - fechaCumplimiento(n) >= fechaInicio(n)
 * - Recalcular únicamente la cola (n+1..fin), iniciando la n+1 el MISMO día de fechaCumplimiento(n).
 * - Idempotencia: si n ya está finalizada con la misma fecha, no hacer nada.
 * - Feriados: exactitud total. Se borran TODOS los vínculos VacanteDiaNoLaboral y se reconstruyen
 *   en base a ventanas:
 *     * Etapas finalizadas: [fechaInicio, fechaCumplimiento] (real)
 *     * Etapas no finalizadas: [fechaInicio, fechaFinalizacion] (planificada)
 */

/**
 * Reconstituye completamente VacanteDiaNoLaboral para una vacante.
 * - Elimina todos los vínculos actuales.
 * - Reconstruye en base a feriados y las ventanas real/plan de cada etapa.
 *
 * @param tx Prisma.TransactionClient
 * @param vacanteId string
 * @param empresaId string
 */
async function rebuildVacanteDiaNoLaboral(tx, vacanteId, empresaId) {
    // Feriados de la empresa
    const feriados = await tx.diaNoLaboral.findMany({
        where: { empresaId },
        select: { id: true, fecha: true }
    })
    const holidaySet = new Set(feriados.map(f => dayjs.utc(f.fecha).format('YYYY-MM-DD')))
    const holidayMap = new Map(feriados.map(f => [dayjs.utc(f.fecha).format('YYYY-MM-DD'), f.id]))

    // Todas las etapas de la vacante (ordenadas)
    const etapas = await tx.vacanteEtapa.findMany({
        where: { vacanteId },
        orderBy: { procesoEtapa: { orden: 'asc' } },
        select: {
            id: true,
            estado: true,
            fechaInicio: true,
            fechaFinalizacion: true,
            fechaCumplimiento: true
        }
    })

    // Borrar vínculos actuales
    await tx.vacanteDiaNoLaboral.deleteMany({ where: { vacanteId } })

    // Recolectar feriados dentro de las ventanas
    const holidayKeysToCreate = new Set()

    const collectHolidaysBetween = (startIso, endIso) => {
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

        // Ventana real si finalizada; si no, planificada
        let end = null
        if (e.estado === 'finalizada' && e.fechaCumplimiento) {
            end = dayjs.utc(e.fechaCumplimiento).format('YYYY-MM-DD')
        } else if (e.fechaFinalizacion) {
            end = dayjs.utc(e.fechaFinalizacion).format('YYYY-MM-DD')
        }

        if (!end) continue
        collectHolidaysBetween(start, end)
    }

    // Crear vínculos
    for (const key of holidayKeysToCreate) {
        const diaNoLaboralId = holidayMap.get(key)
        if (!diaNoLaboralId) continue
        await tx.vacanteDiaNoLaboral.create({
            data: {
                vacanteId,
                diaNoLaboralId,
                uc: getCurrentUser().id,
                um: getCurrentUser().id
            }
        })
    }
}

/**
 * Completa una etapa y recalcula la cola.
 * @param {{ id: string, fechaCumplimiento: string|Date }} input
 * @returns {Promise<{data: any}>}
 */
async function completarEtapa(input) {
    try {

        const currentUser = getCurrentUser()

        const doneDate = toDateOnly(input.fechaCumplimiento) // Date-only (UTC 00:00)

        // Cargar la etapa + vacante + orden
        const etapa = await prisma.vacanteEtapa.findFirst({
            where: { id: input.id },
            include: {
                vacante: {
                    select: {
                        id: true,
                        empresaId: true,
                        procesoId: true,
                        estado: true,
                        diasHabilesFinalizacion: true
                    }
                },
                procesoEtapa: {
                    select: {
                        id: true,
                        orden: true,
                        etapa: { select: { slaDias: true, nombre: true } }
                    }
                }
            }
        })
        if (!etapa) throw new TalentFlowError('La etapa indicada no existe.', 404)
 
        if(etapa.vacante.estado !== 'abierta') throw new TalentFlowError('La vacante debe estar abierta', 409)

        // Traer TODAS las etapas de esa vacante, ordenadas
        const etapas = await prisma.vacanteEtapa.findMany({
            where: { vacanteId: etapa.vacanteId },
            orderBy: { procesoEtapa: { orden: 'asc' } },
            include: {
                procesoEtapa: { select: { orden: true, etapa: { select: { slaDias: true } } } }
            }
        })
        if (!etapas.length) throw new TalentFlowError('La vacante no tiene etapas configuradas.', 400)

        const idx = etapas.findIndex(e => e.id === etapa.id)
        if (idx < 0) throw new TalentFlowError('Inconsistencia: la etapa no pertenece a la vacante.', 409)

        const etapaActual = etapas[idx]
        if (!etapaActual.fechaInicio) {
            throw new TalentFlowError('La etapa actual no tiene fechaInicio establecida.', 400)
        }

        // Validación: fechaCumplimiento(n) >= fechaInicio(n)
        const startN = dayjs.utc(etapaActual.fechaInicio)
        if (dayjs.utc(doneDate).isBefore(startN, 'day')) {
            throw new TalentFlowError('fechaCumplimiento no puede ser anterior a la fechaInicio de la etapa.', 400)
        }

        // Validación: etapa n-1 finalizada y encadenamiento exacto
        if (idx > 0) {
            const prev = etapas[idx - 1]
            if (prev.estado !== 'finalizada' || !prev.fechaCumplimiento) {
                throw new TalentFlowError('La etapa previa debe estar finalizada.', 400)
            }
            const prevDone = dayjs.utc(prev.fechaCumplimiento).format('YYYY-MM-DD')
            const startNStr = dayjs.utc(etapaActual.fechaInicio).format('YYYY-MM-DD')
            if (prevDone !== startNStr) {
                throw new TalentFlowError(
                    'Invariante roto: fechaCumplimiento de la etapa previa debe ser igual a la fechaInicio de la etapa actual.',
                    409
                )
            }
        }

        // Feriados de la empresa (para recálculo de cola)
        const feriados = await prisma.diaNoLaboral.findMany({
            where: { empresaId: etapa.vacante.empresaId },
            select: { id: true, fecha: true }
        })
        const holidaySet = new Set(feriados.map(f => dayjs.utc(f.fecha).format('YYYY-MM-DD')))

        const nextIndex = idx + 1
        const hasNext = nextIndex < etapas.length

        // Idempotencia: si ya está finalizada con la misma fecha, evitamos escrituras innecesarias,
        // pero igual reconstruimos feriados (por exactitud total).
        const isSameFinal =
            etapaActual.estado === 'finalizada' &&
            etapaActual.fechaCumplimiento &&
            dayjs.utc(etapaActual.fechaCumplimiento).format('YYYY-MM-DD') === dayjs.utc(doneDate).format('YYYY-MM-DD')

        const result = await prisma.$transaction(async (tx) => {
            // 1) Finalizar n (si no idempotente)
            if (!isSameFinal) {
                await tx.vacanteEtapa.update({
                    where: { id: etapaActual.id },
                    data: {
                        fechaCumplimiento: doneDate,
                        estado: 'finalizada',
                        um: currentUser.id
                    }
                })
            }

            // 2) Recalcular cola (n+1..fin)
            if (hasNext) {

                // 👇 Aseguramos que la vacante esté abierta; si estaba finalizada, la reabrimos.
                await tx.vacante.update({
                    where: { id: etapa.vacanteId },
                    data: { estado: 'abierta', um: currentUser.id },
                    diasHabilesFinalizacion: null
                })

                let cursor = dayjs.utc(doneDate) // la siguiente empieza el mismo día de la finalización real de n

                for (let i = nextIndex; i < etapas.length; i++) {
                    const it = etapas[i]
                    const sla = Number(it.procesoEtapa.etapa.slaDias) || 0
                    const { start, end } = addBusinessDaysInclusive(cursor, Math.max(1, sla), holidaySet)

                    await tx.vacanteEtapa.update({
                        where: { id: it.id },
                        data: {
                            fechaInicio: new Date(start.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                            fechaFinalizacion: new Date(end.format('YYYY-MM-DD') + 'T00:00:00.000Z'),
                            fechaCumplimiento: null,
                            estado: i === nextIndex ? 'abierta' : 'pendiente',
                            um: currentUser.id
                        }
                    })

                    cursor = end // siguiente arranca cuando termina la anterior
                }
            } else {
                await tx.vacante.update({
                    where: { id: etapa.vacanteId },
                    data: {
                        estado: 'finalizada', // 'finalizada' o 'cerrada' según tu enum
                        um: currentUser.id,
                        diasHabilesFinalizacion: null
                    },
                })

                await tx.vacanteEtapa.updateMany({
                    where: { vacanteId: etapa.vacanteId, estado: { in: ['abierta', 'pendiente'] } },
                    data: { estado: 'finalizada', um: currentUser.id },
                })
            }

            // 3) Exactitud total de feriados (borrar y reconstruir TODOS)
            await rebuildVacanteDiaNoLaboral(tx, etapa.vacante.id, etapa.vacante.empresaId)

            // 4) Devolver snapshot actualizado
            const vacanteSnap = await tx.vacante.findUnique({
                where: { id: etapa.vacante.id },
                include: {
                    proceso: { select: { nombre: true } },
                    etapasVacante: {
                        orderBy: { procesoEtapa: { orden: 'asc' } },
                        include: {
                            procesoEtapa: {
                                select: { orden: true, etapa: { select: { nombre: true, slaDias: true } } }
                            }
                        }
                    }
                }
            })

            // Normalización de fechas a YYYY-MM-DD (si querés mantener consistencia de salida)
            for (const eV of vacanteSnap.etapasVacante) {
                if (eV.fechaInicio) eV.fechaInicio = dayjs.utc(eV.fechaInicio).format('YYYY-MM-DD')
                if (eV.fechaFinalizacion) eV.fechaFinalizacion = dayjs.utc(eV.fechaFinalizacion).format('YYYY-MM-DD')
                if (eV.fechaCumplimiento) eV.fechaCumplimiento = dayjs.utc(eV.fechaCumplimiento).format('YYYY-MM-DD')
            }

            return vacanteSnap
        })

        return { data: result }
    } catch (e) {
        if (e instanceof TalentFlowError) throw e
        throw mapPrismaError(e, { resource: 'Vacante/Etapa' })
    }
}


export const VacanteService = {
    getByEmpresa,
    post,
    patch,
    getResumenPorEstado,
    getById,
    completarEtapa
}
