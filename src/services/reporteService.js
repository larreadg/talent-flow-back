import ExcelJS from 'exceljs'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import utc from 'dayjs/plugin/utc.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import { prisma } from '../prismaClient.js'
import { mapPrismaError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { normalizeList, buildOrderBy } from '../utils/vacanteUtils.js'

dayjs.extend(utc)
dayjs.extend(localizedFormat)
dayjs.locale('es')

/**
 * Generar reporte de vacantes en Excel.
 * - id?: filtra por vacante específica
 * - Colores por etapa: rojo si fechaCumplimiento > fechaFinalizacion, verde en caso contrario
 * - J: Observaciones (comentarios, siempre negro)
 * - K: No laborables (días) = fines de semana + feriados (conteo) en la ventana global de la vacante
 * - L: Duración del Proceso (días) = días hábiles únicos (mergeado por vacante, siempre negro)
 * - Fechas/timestamps con dayjs para evitar desfasajes por TZ
 */
async function generarReporte({ estados = null, departamentos = null, sedes = null, id = null } = {}) {
    try {
        const currentUser = getCurrentUser();

        // ==== Helpers con dayjs (TZ controlada) ====
        const toYMD = (d) => (d ? dayjs.utc(d).format('YYYY-MM-DD') : null);

        // Convierte un Y-M-D a Date UTC midnight (para que Excel no desplace por TZ)
        const ymdToExcelDate = (ymd) => {
            if (!ymd) return null;
            return dayjs.utc(`${ymd}T00:00:00Z`).toDate();
        };

        // Timestamps locales (Asunción -03:00) para comentarios
        const formatLocalTs = (dt) => {
            if (!dt) return '';
            return dayjs.utc(dt).utcOffset(-180).format('YYYY-MM-DD HH:mm');
        };

        const addDaysUTC = (ymd, days) =>
            dayjs.utc(`${ymd}T00:00:00Z`).add(days, 'day').format('YYYY-MM-DD');

        const isWeekendYMD = (ymd) => {
            const dow = dayjs.utc(`${ymd}T00:00:00Z`).day(); // 0=Dom .. 6=Sáb
            return dow === 0 || dow === 6;
        };

        const listDatesInclusive = (startYmd, endYmd) => {
            const out = [];
            if (!startYmd || !endYmd) return out;
            let cur = startYmd;
            if (dayjs.utc(`${cur}T00:00:00Z`).isAfter(dayjs.utc(`${endYmd}T00:00:00Z`))) return out;
            while (true) {
                out.push(cur);
                if (cur === endYmd) break;
                cur = addDaysUTC(cur, 1);
            }
            return out;
        };

        const listBusinessDaysInclusive = (startYmd, endYmd, isWorkingDay) => {
            const out = [];
            if (!startYmd || !endYmd) return out;
            let cur = startYmd;
            if (dayjs.utc(`${cur}T00:00:00Z`).isAfter(dayjs.utc(`${endYmd}T00:00:00Z`))) return out;
            while (true) {
                const d = dayjs.utc(`${cur}T00:00:00Z`);
                if (isWorkingDay(d)) out.push(cur);
                if (cur === endYmd) break;
                cur = addDaysUTC(cur, 1);
            }
            return out;
        };

        const isWorkingDayFactory = (holidaySet) => (dateDayjsUtc) => {
            const ymd = dateDayjsUtc.format('YYYY-MM-DD');
            if (isWeekendYMD(ymd)) return false;
            if (holidaySet.has(ymd)) return false;
            return true;
        };

        const countBusinessDaysInclusive = (startYmd, endYmd, isWorkingDay) =>
            listBusinessDaysInclusive(startYmd, endYmd, isWorkingDay).length;

        const STATE_STYLE = {
            abierta: { fg: 'FF3B82F6', font: 'FFFFFFFF' }, // azul
            pausada: { fg: 'FFF59E0B', font: 'FF000000' }, // amarillo (texto negro)
            finalizada: { fg: 'FF22C55E', font: 'FFFFFFFF' }, // verde
            cancelada: { fg: 'FFEC4899', font: 'FFFFFFFF' }, // rosa
        };
        const DEFAULT_STATE_STYLE = { fg: 'FF6B7280', font: 'FFFFFFFF' }; // gris
        const formatResponsable = (v) => (v === 'reclutamiento' ? 'Reclutamiento' : 'Solicitante');

        // Borde grueso alrededor de un bloque (A..L) por grupo de vacante
        function applyThickBorderForGroup(ws, startRow, endRow, firstCol = 1, lastCol = 12) {
            for (let c = firstCol; c <= lastCol; c++) {
                ws.getCell(startRow, c).border = {
                    ...ws.getCell(startRow, c).border,
                    top: { style: 'thick', color: { argb: 'FF000000' } },
                };
                ws.getCell(endRow, c).border = {
                    ...ws.getCell(endRow, c).border,
                    bottom: { style: 'thick', color: { argb: 'FF000000' } },
                };
            }
            for (let r = startRow; r <= endRow; r++) {
                ws.getCell(r, firstCol).border = {
                    ...ws.getCell(r, firstCol).border,
                    left: { style: 'thick', color: { argb: 'FF000000' } },
                };
                ws.getCell(r, lastCol).border = {
                    ...ws.getCell(r, lastCol).border,
                    right: { style: 'thick', color: { argb: 'FF000000' } },
                };
            }
        }

        // ==== Filtro y query ====
        const estadosList = normalizeList(estados);
        const departamentosList = normalizeList(departamentos);
        const sedesList = normalizeList(sedes);

        const baseWhere = { empresaId: currentUser.empresaId, activo: true };
        const and = [baseWhere];
        if (id) and.push({ id }); // filtro por vacante específica
        if (estadosList.length) and.push({ estado: { in: estadosList } });
        if (departamentosList.length) and.push({ departamentoId: { in: departamentosList } });
        if (sedesList.length) and.push({ sedeId: { in: sedesList } });
        const where = and.length > 1 ? { AND: and } : baseWhere;

        const orderBy = buildOrderBy('nombre', 'asc');

        // Vacantes + etapas + comentarios + feriados
        const vacantes = await prisma.vacante.findMany({
            where,
            orderBy,
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
                                responsable: true,
                                etapa: { select: { nombre: true, slaDias: true } },
                            },
                        },
                        comentarios: {
                            select: { id: true, comentario: true, uc: true, fc: true },
                        },
                    },
                },
                diasNoLaborales: {
                    orderBy: { diaNoLaboral: { fecha: 'asc' } },
                    include: { diaNoLaboral: { select: { id: true, nombre: true, fecha: true } } },
                },
            },
        });

        // ==== Resolver nombres de autores de comentarios (Usuario) ====
        const allAuthorIds = [];
        for (const vac of vacantes) {
            for (const ev of vac.etapasVacante ?? []) {
                for (const c of ev.comentarios ?? []) {
                    if (c.uc) allAuthorIds.push(c.uc);
                }
            }
        }
        const uniqueAuthorIds = Array.from(new Set(allAuthorIds));
        let userMap = new Map();
        if (uniqueAuthorIds.length) {
            const users = await prisma.usuario.findMany({
                where: { id: { in: uniqueAuthorIds } },
                select: { id: true, nombre: true, apellido: true },
            });
            userMap = new Map(users.map(u => [u.id, `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || 'Desconocido']));
        }

        // ==== Excel ====
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();
        wb.locale = 'es';
        const ws = wb.addWorksheet('Vacantes');

        // Encabezado
        ws.getCell('A1').value = 'Talent Flow';
        ws.mergeCells('A1:L1');
        ws.getCell('A1').font = { bold: true, size: 14 };
        ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
        ws.getCell('A2').value = 'Fecha de generación';
        ws.getCell('B2').value = dayjs().utcOffset(-180).format('DD/MM/YYYY HH:mm');
        ws.getCell('A2').font = { bold: true };

        // Cabecera (J=Observaciones, K=No laborables (días), L=Duración del Proceso (días))
        const headers = [
            'Vacante', 'Estado', 'Etapa', 'SLA (días)', 'Fecha Inicio',
            'Fecha Finaliz.', 'Fecha Cump', 'Responsable', 'Total (días)',
            'Observaciones', 'No laborables (días)', 'Duración del Proceso (días)',
        ];
        const headerRow = ws.getRow(4);
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' },
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        });

        // Anchos
        ws.getColumn(1).width = 26; // Vacante
        ws.getColumn(2).width = 14; // Estado
        ws.getColumn(3).width = 28; // Etapa
        ws.getColumn(4).width = 12; // SLA
        ws.getColumn(5).width = 14; // Fecha Inicio
        ws.getColumn(6).width = 14; // Fecha Finaliz.
        ws.getColumn(7).width = 14; // Fecha Cump
        ws.getColumn(8).width = 22; // Responsable
        ws.getColumn(9).width = 12; // Total (días)
        ws.getColumn(10).width = 40; // Observaciones (J)
        ws.getColumn(11).width = 16; // No laborables (días) (K)
        ws.getColumn(12).width = 22; // Duración del Proceso (días) (L)

        // Activa el autofiltro en todas las columnas del header (A4..L4)
        // ws.autoFilter = {
        //     from: { row: 4, column: 1 },   // A4
        //     to:   { row: 4, column: 12 },  // L4
        // };

        let rowIdx = 5;

        for (const vac of vacantes) {
            const etapas = vac.etapasVacante ?? [];

            // === Feriados explícitos de la vacante ===
            const feriadosYmd = (vac.diasNoLaborales ?? [])
                .map(vdl => toYMD(vdl.diaNoLaboral.fecha))
                .filter(Boolean)
                .sort();
            const holidaySet = new Set(feriadosYmd);
            const isWorkingDay = isWorkingDayFactory(holidaySet);

            // === L: DÍAS HÁBILES ÚNICOS (Duración del Proceso) ===
            const covered = new Set();
            for (const eV of etapas) {
                const startStr = toYMD(eV.fechaInicio);
                const endForElapsed = toYMD(eV.fechaCumplimiento || eV.fechaFinalizacion);
                const list = listBusinessDaysInclusive(startStr, endForElapsed, isWorkingDay);
                for (const ymd of list) covered.add(ymd);
            }
            const duracionProcesoHabilesUnicos = covered.size;

            // === K: Conteo de días no laborables (fines de semana + feriados) ===
            let diasNoLaboralesCount = 0;
            if (etapas.length) {
                const starts = etapas.map(e => toYMD(e.fechaInicio)).filter(Boolean).sort();
                const ends = etapas.map(e => toYMD(e.fechaCumplimiento || e.fechaFinalizacion)).filter(Boolean).sort();
                const minStart = starts[0] || null;
                const maxEnd = ends.length ? ends[ends.length - 1] : null;

                if (minStart && maxEnd) {
                    const allDays = listDatesInclusive(minStart, maxEnd);
                    for (const ymd of allDays) {
                        if (isWeekendYMD(ymd) || holidaySet.has(ymd)) diasNoLaboralesCount++;
                    }
                }
            }

            // === Render filas de etapas ===
            const startRow = rowIdx;

            if (etapas.length) {
                for (const ev of etapas) {
                    const r = ws.getRow(rowIdx);

                    // Etapa / SLA / fechas / responsable
                    r.getCell(3).value = ev.procesoEtapa?.etapa?.nombre ?? '';
                    r.getCell(4).value = Number(ev.procesoEtapa?.etapa?.slaDias ?? 0);

                    const inicioYmd = toYMD(ev.fechaInicio);
                    const finYmd = toYMD(ev.fechaFinalizacion);
                    const cumpYmd = toYMD(ev.fechaCumplimiento);

                    r.getCell(5).value = ymdToExcelDate(inicioYmd);
                    r.getCell(6).value = ymdToExcelDate(finYmd);
                    r.getCell(7).value = ymdToExcelDate(cumpYmd);
                    r.getCell(5).numFmt = r.getCell(6).numFmt = r.getCell(7).numFmt = 'dd/mm/yyyy';

                    r.getCell(8).value = formatResponsable(ev.procesoEtapa?.responsable);

                    // Total (días) = HÁBILES por etapa
                    const totalEtapa = countBusinessDaysInclusive(
                        inicioYmd,
                        (cumpYmd || finYmd),
                        isWorkingDay
                    );
                    r.getCell(9).value = totalEtapa || '';

                    // J: Observaciones (comentarios por etapa) — SIEMPRE NEGRO
                    const comentariosOrdenados = (ev.comentarios ?? [])
                        .slice()
                        .sort((a, b) => dayjs.utc(b.fc).valueOf() - dayjs.utc(a.fc).valueOf());
                    const obs = comentariosOrdenados.map(c => {
                        const autor = userMap.get(c.uc) || 'Desconocido';
                        const ts = formatLocalTs(c.fc);
                        return `[${ts}] ${autor}: ${c.comentario}`;
                    }).join('\n');
                    const jCell = r.getCell(10);
                    jCell.value = obs;
                    jCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                    jCell.font = { ...(jCell.font || {}), color: { argb: 'FF000000' } }; // negro

                    // Bordes finos por celda
                    for (let c = 1; c <= 12; c++) {
                        r.getCell(c).border = {
                            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                            right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        };
                    }

                    // === Color condicional (solo C..I) ===
                    const cump = ev.fechaCumplimiento ? dayjs.utc(ev.fechaCumplimiento) : null;
                    const fin  = ev.fechaFinalizacion ? dayjs.utc(ev.fechaFinalizacion) : null;

                    let fontColor = 'FF000000'; // negro por defecto (cuando cump = null)

                    if (cump) {
                    if (fin) {
                        fontColor = cump.isAfter(fin) ? 'FFFF0000' : 'FF008000'; // rojo : verde
                    } else {
                        fontColor = 'FF008000'; // sin fechaFinalizacion → no consideramos atraso
                    }
                    }

                    // Solo C..I (3..9)
                    for (const col of [3, 4, 5, 6, 7, 8, 9]) {
                        const cell = r.getCell(col);
                        cell.font = { ...(cell.font || {}), color: { argb: fontColor } };
                    }
                    // Forzamos negro en J,K,L
                    [10, 11, 12].forEach(col => {
                        const cell = r.getCell(col);
                        cell.font = { ...(cell.font || {}), color: { argb: 'FF000000' } };
                    });

                    rowIdx++;
                }
            } else {
                // Sin etapas: solo mostramos agregados; aseguramos negro en K y L
                const r = ws.getRow(rowIdx);
                for (let c = 1; c <= 12; c++) {
                    r.getCell(c).border = {
                        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    };
                }
                // (J se deja vacío, K/L los seteo más abajo al merge)
                rowIdx++;
            }

            const endRow = Math.max(startRow, rowIdx - 1);

            // A: Vacante (merge + color por estado)
            ws.mergeCells(`A${startRow}:A${endRow}`);
            const vacCell = ws.getCell(`A${startRow}`);
            const st = STATE_STYLE[vac.estado] || DEFAULT_STATE_STYLE;
            vacCell.value = vac.nombre || '';
            vacCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            vacCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fg } };
            vacCell.font = { color: { argb: st.font }, bold: true };

            // B: Estado (merge)
            ws.mergeCells(`B${startRow}:B${endRow}`);
            const estCell = ws.getCell(`B${startRow}`);
            estCell.value = vac.estado || '';
            estCell.alignment = { vertical: 'middle', horizontal: 'center' };
            estCell.font = { bold: true };

            // K: No laborables (días) — merge, centrado, negro
            ws.mergeCells(`K${startRow}:K${endRow}`);
            const kCell = ws.getCell(`K${startRow}`);
            kCell.value = diasNoLaboralesCount || 0;
            kCell.alignment = { vertical: 'middle', horizontal: 'center' };
            kCell.font = { ...(kCell.font || {}), color: { argb: 'FF000000' } };

            // L: Duración del Proceso (días) — merge, centrado, negro
            ws.mergeCells(`L${startRow}:L${endRow}`);
            const lCell = ws.getCell(`L${startRow}`);
            lCell.value = duracionProcesoHabilesUnicos || '';
            lCell.alignment = { vertical: 'middle', horizontal: 'center' };
            lCell.font = { ...(lCell.font || {}), color: { argb: 'FF000000' } };

            // Borde grueso por grupo (A..L)
            applyThickBorderForGroup(ws, startRow, endRow, 1, 12);
        }

        // Normalización de fechas (por si quedaron strings residuales)
        for (let r = 5; r <= rowIdx; r++) {
            for (const col of ['E', 'F', 'G']) {
                const cell = ws.getCell(`${col}${r}`);
                if (typeof cell.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cell.value)) {
                    cell.value = ymdToExcelDate(cell.value);
                    cell.numFmt = 'dd/mm/yyyy';
                }
            }
        }

        // Congelar cabecera
        ws.views = [{ state: 'frozen', ySplit: 4 }];

        const filename = `vacantes_${dayjs().utcOffset(-180).format('YYYYMMDD_HHmm')}.xlsx`;
        const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const buffer = await wb.xlsx.writeBuffer();
        return { buffer, filename, mime };
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Reporte de Vacantes' });
    }
}

/**
 * Resumen de vacantes de la empresa dentro/fuera del SLA máximo de Proceso (en días hábiles).
 * - Días hábiles = excluye sábados, domingos y DiaNoLaboral de la empresa.
 * - Inicio del proceso: mínima fechaInicio entre sus etapas; si no hay, usa vacante.fechaInicio; si tampoco hay, usa vacante.fc.
 * - Fin:
 *    * si vacante está finalizada: máxima fechaCumplimiento; si falta, usa máxima fechaFinalizacion; si no hay, vacante.fc
 *    * si vacante está abierta/pausada/etc.: min(hoy, fechaCorte opcional)
 * - Solo cuentan vacantes cuyo Proceso tiene slaMaximoDias != null (las otras van a `sinSLA`).
 *
 * @param {{ estados?: string[]|string, departamentos?: string[]|string, sedes?: string[]|string, fechaCorte?: string }} params
 *   - fechaCorte: 'YYYY-MM-DD' (opcional), por defecto hoy (UTC date-only).
 * @returns {Promise<{
*   empresaId: string,
*   fechaCorte: string,
*   totalVacantes: number,
*   consideradas: number,
*   sinSLA: number,
*   dentroSLA: number,
*   fueraSLA: number,
*   procesos: Array<{ procesoId: string, nombre: string, slaMaximoDias: number, consideradas: number, dentroSLA: number, fueraSLA: number }>
* }>}
*/
async function getSLAResumenMaximo({ estados = null, departamentos = null, sedes = null, fechaCorte = null } = {}) {
    try {
        const currentUser = getCurrentUser()
        const toYMD = (d) => (d ? dayjs.utc(d).format('YYYY-MM-DD') : null)
        const todayISO = dayjs.utc().format('YYYY-MM-DD')
        const corteISO = fechaCorte ? dayjs.utc(fechaCorte).format('YYYY-MM-DD') : todayISO

        // ====== Filtros coherentes con tu estilo ======
        const estadosList = normalizeList(estados)
        const departamentosList = normalizeList(departamentos)
        const sedesList = normalizeList(sedes)

        const baseWhere = { empresaId: currentUser.empresaId, activo: true, estado: { in: ['abierta', 'finalizada'] } }
        const and = [baseWhere]
        if (estadosList.length) and.push({ estado: { in: estadosList } })
        if (departamentosList.length) and.push({ departamentoId: { in: departamentosList } })
        if (sedesList.length) and.push({ sedeId: { in: sedesList } })
        const where = and.length > 1 ? { AND: and } : baseWhere

        // Traemos lo que necesitamos: Proceso con slaMaximoDias, etapas (fechas), y no laborables de la EMPRESA
        const vacantes = await prisma.vacante.findMany({
            where,
            select: {
                id: true,
                estado: true,
                fc: true,
                fechaInicio: true,
                proceso: { select: { id: true, nombre: true, slaMaximoDias: true } },
                etapasVacante: {
                    orderBy: { procesoEtapa: { orden: 'asc' } },
                    select: { fechaInicio: true, fechaFinalizacion: true, fechaCumplimiento: true },
                },
            },
        })

        if (!vacantes.length) {
            return {
                empresaId: currentUser.empresaId,
                fechaCorte: corteISO,
                totalVacantes: 0,
                consideradas: 0,
                sinSLA: 0,
                dentroSLA: 0,
                fueraSLA: 0,
                procesos: [],
            }
        }

        // Determinar rango mínimo para traer feriados una sola vez
        let minInicioGlobal = corteISO
        for (const v of vacantes) {
            const etapas = v.etapasVacante ?? []
            const minEtapaInicio = etapas.map(e => toYMD(e.fechaInicio)).filter(Boolean).sort()[0]
            const inicio = minEtapaInicio ?? toYMD(v.fechaInicio) ?? toYMD(v.fc)
            if (inicio && inicio < minInicioGlobal) minInicioGlobal = inicio
        }

        // Días no laborables (feriados) de la EMPRESA en [minInicioGlobal, corteISO]
        const feriados = await prisma.diaNoLaboral.findMany({
            where: { empresaId: currentUser.empresaId, fecha: { gte: new Date(minInicioGlobal), lte: new Date(corteISO) } },
            select: { fecha: true },
        })
        const feriadoSet = new Set(feriados.map(f => dayjs.utc(f.fecha).format('YYYY-MM-DD')))

        // Helpers de hábiles (basados en tu approach de utilidades/servicios)
        const isWorkingDayYMD = (ymd) => {
            const dow = dayjs.utc(ymd).day() // 0=Dom..6=Sáb
            if (dow === 0 || dow === 6) return false
            return !feriadoSet.has(dayjs.utc(ymd).format('YYYY-MM-DD'))
        }
        // Cuenta días hábiles INCLUSIVOS entre dos YMD
        const countBusinessDaysInclusive = (startYmd, endYmd) => {
            if (!startYmd || !endYmd) return 0
            const start = dayjs.utc(startYmd)
            const end = dayjs.utc(endYmd)
            if (end.isBefore(start, 'day')) return 0
            let d = start
            let count = 0
            while (!d.isAfter(end, 'day')) {
                if (isWorkingDayYMD(d)) count++
                d = d.add(1, 'day')
            }
            return count
        }

        // Acumuladores
        let sinSLA = 0, dentroSLA = 0, fueraSLA = 0
        const procMap = new Map() // procesoId -> { ... }

        // Recorremos vacantes
        for (const v of vacantes) {
            const p = v.proceso
            if (!p || p.slaMaximoDias == null) {
                sinSLA++
                continue
            }

            const etapas = v.etapasVacante ?? []
            // Inicio
            const minEtapaInicio = etapas.map(e => toYMD(e.fechaInicio)).filter(Boolean).sort()[0]
            const inicio = minEtapaInicio ?? toYMD(v.fechaInicio) ?? toYMD(v.fc)

            // Fin
            const maxCumpl = etapas.map(e => toYMD(e.fechaCumplimiento)).filter(Boolean).sort().slice(-1)[0]
            const maxPlan = etapas.map(e => toYMD(e.fechaFinalizacion)).filter(Boolean).sort().slice(-1)[0]
            const cerrada = (v.estado === 'finalizada' || v.estado === 'cerrada' || v.estado === 'CERRADA' || v.estado === 'CERRADA_OK')
            let fin = cerrada ? (maxCumpl ?? maxPlan ?? toYMD(v.fc)) : corteISO
            if (!fin) fin = corteISO
            if (fin > corteISO) fin = corteISO

            // Días hábiles transcurridos (INCLUSIVO)
            const diasHabiles = countBusinessDaysInclusive(inicio, fin)

            const dentro = diasHabiles <= Number(p.slaMaximoDias)
            if (dentro) dentroSLA++; else fueraSLA++

            // Detalle por proceso
            if (!procMap.has(p.id)) {
                procMap.set(p.id, {
                    procesoId: p.id,
                    nombre: p.nombre,
                    slaMaximoDias: Number(p.slaMaximoDias),
                    consideradas: 0,
                    dentroSLA: 0,
                    fueraSLA: 0,
                })
            }
            const slot = procMap.get(p.id)
            slot.consideradas++
            if (dentro) slot.dentroSLA++; else slot.fueraSLA++
        }

        const consideradas = dentroSLA + fueraSLA

        return {
            empresaId: currentUser.empresaId,
            fechaCorte: corteISO,
            totalVacantes: vacantes.length,
            consideradas,
            sinSLA,
            dentroSLA,
            fueraSLA,
            procesos: Array.from(procMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        }
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Reporte SLA Máximo' })
    }
}

/**
 * Top N de departamentos por cantidad de etapas incumplidas.
 * Incumplimiento: fechaCumplimiento > fechaFinalizacion.
 *
 * Filtros opcionales:
 *  - estados: string|string[]
 *  - departamentos: string|string[]
 *  - sedes: string|string[]
 *  - fechaDesde / fechaHasta: rango sobre fechaCumplimiento (YYYY-MM-DD)
 *
 * Respuesta:
 *  {
 *    totalIncumplimientos: number,
 *    items: [{ departamentoId, nombre, incumplimientos, pct }]
 *  }
 */
export async function getTopDepartamentosIncumplimientoEtapas({
    limit = 5,
    estados = null,
    departamentos = null,
    sedes = null,
    fechaDesde = null,
    fechaHasta = null
} = {}) {
    try {
        const currentUser = getCurrentUser()

        const estadosList = normalizeList(estados)
        const departamentosList = normalizeList(departamentos)
        const sedesList = normalizeList(sedes)

        // Rango de fechas (sobre fechaCumplimiento) si viene
        const desde = fechaDesde ? dayjs.utc(fechaDesde).startOf('day').toDate() : undefined
        const hasta = fechaHasta ? dayjs.utc(fechaHasta).endOf('day').toDate() : undefined

        // WHERE de la vacante (empresa + filtros de alto nivel)
        const vacanteWhere = {
            empresaId: currentUser.empresaId,
            activo: true,
            ...(estadosList.length ? { estado: { in: estadosList } } : {}),
            ...(departamentosList.length ? { departamentoId: { in: departamentosList } } : {}),
            ...(sedesList.length ? { sedeId: { in: sedesList } } : {}),
        }

        // Traigo SOLO etapas con ambas fechas presentes; el > lo evaluamos en JS
        const etapas = await prisma.vacanteEtapa.findMany({
            where: {
                AND: [
                    { fechaCumplimiento: { not: null } },
                    { fechaFinalizacion: { not: null } },
                    ...(desde ? [{ fechaCumplimiento: { gte: desde } }] : []),
                    ...(hasta ? [{ fechaCumplimiento: { lte: hasta } }] : []),
                ],
                vacante: vacanteWhere,
            },
            select: {
                fechaCumplimiento: true,
                fechaFinalizacion: true,
                vacante: {
                    select: {
                        departamentoId: true,
                        departamento: { select: { nombre: true } }, // relación existente en tu código
                    },
                },
            },
        })

        // Agrupar y contar incumplimientos por departamento
        const counts = new Map() // depId -> { nombre, count }
        let totalIncumplimientos = 0

        for (const e of etapas) {
            const fc = e.fechaCumplimiento
            const ff = e.fechaFinalizacion
            if (fc && ff && dayjs.utc(fc).isAfter(dayjs.utc(ff))) {
                const depId = e.vacante.departamentoId ?? 'SIN_DEP'
                const nombre = e.vacante.departamento?.nombre ?? 'Sin Departamento'
                const cur = counts.get(depId) ?? { nombre, count: 0 }
                cur.count += 1
                counts.set(depId, cur)
                totalIncumplimientos += 1
            }
        }

        // Ordenar DESC por count y tomar top N
        const itemsSorted = Array.from(counts.entries())
            .sort((a, b) => (b[1].count - a[1].count) || a[1].nombre.localeCompare(b[1].nombre))
            .slice(0, Number(limit) || 5)
            .map(([departamentoId, v]) => ({
                departamentoId,
                nombre: v.nombre,
                incumplimientos: v.count,
                pct: totalIncumplimientos ? Math.round((v.count / totalIncumplimientos) * 100) : 0,
            }))

        return {
            totalIncumplimientos,
            items: itemsSorted,
        }
    } catch (err) {
        throw mapPrismaError(err, { resource: 'Top Departamentos Incumplimientos' })
    }
}

/**
 * Array de 12 elementos con resumen mensual de vacantes abiertas, finalizadas y aumentoDotacion,
 * tomando como mes de referencia el de la vacante más nueva (por fechaInicio).
 */
async function getResumenVacantesMensualUltimos12Meses() {
    try {
        const currentUser = getCurrentUser();

        const vacanteMasNueva = await prisma.vacante.findFirst({
            where: {
                empresaId: currentUser.empresaId,
                activo: true,
                estado: { in: ['abierta', 'finalizada'] },
            },
            orderBy: { fechaInicio: 'desc' },
            select: { fechaInicio: true },
        });

        const mesRef = vacanteMasNueva
            ? dayjs.utc(vacanteMasNueva.fechaInicio).startOf('month')
            : dayjs.utc().startOf('month');

        const inicioRango = mesRef.subtract(11, 'month').startOf('month');
        const finRango = mesRef.endOf('month');

        const vacantes = await prisma.vacante.findMany({
            where: {
                empresaId: currentUser.empresaId,
                activo: true,
                estado: { in: ['abierta', 'finalizada'] },
                fechaInicio: {
                    gte: inicioRango.toDate(),
                    lte: finRango.toDate(),
                },
            },
            select: {
                id: true,
                estado: true,
                aumentoDotacion: true,
                fechaInicio: true,
            },
        });

        const meses = [];
        for (let i = 0; i < 12; i++) {
            const base = inicioRango.add(i, 'month');
            meses.push({
                label: base.format('MMM YYYY'),
                abiertas: 0,
                finalizadas: 0,
                aumentoDotacion: 0,
            });
        }

        for (const v of vacantes) {
            const fiMes = dayjs.utc(v.fechaInicio).startOf('month');
            const idx = fiMes.diff(inicioRango, 'month');
            if (idx >= 0 && idx < 12) {
                if (v.estado === 'abierta') meses[idx].abiertas++;
                if (v.estado === 'finalizada') meses[idx].finalizadas++;
                if (v.aumentoDotacion) meses[idx].aumentoDotacion++;
            }
        }

        return meses;
    } catch (e) {
        throw mapPrismaError(e, { resource: 'Resumen Vacantes Mensual 12m' });
    }
}




export const ReporteService = {
    generarReporte,
    getSLAResumenMaximo,
    getTopDepartamentosIncumplimientoEtapas,
    getResumenVacantesMensualUltimos12Meses
}