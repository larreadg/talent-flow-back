// src/services/vacanteEtapaComentarioService.js
import { prisma } from '../prismaClient.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { mapPrismaError } from '../utils/error.js'
import { pick } from '../utils/utils.js'
import { TalentFlowError } from '../utils/error.js'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import utc from 'dayjs/plugin/utc.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
dayjs.extend(utc)
dayjs.extend(localizedFormat)
dayjs.locale('es')

/** @typedef {import('@prisma/client').VacanteEtapaComentario} VacanteEtapaComentario */

const ALLOWED_FIELDS_CREATE = ['vacanteEtapaId', 'comentario']
const ALLOWED_FIELDS_UPDATE = ['comentario']

const EDIT_WINDOW_MS = 30 * 60 * 1000 // 30 minutos

/**
 * Reglas de negocio para edición:
 * - Solo el creador (uc) puede editar.
 * - Solo dentro de los 30 minutos de creado (fc).
 * @param {VacanteEtapaComentario} item
 * @param {{id: string}} currentUser
 */
function assertCanEdit(item, currentUser) {
    if (!item) throw mapPrismaError({ code: 'P2025' }, { resource: 'VacanteEtapaComentario' })

    if (!item.uc || item.uc !== currentUser.id) {
        throw new TalentFlowError('No tenés permisos para editar este comentario.', 403)
    }

    const now = Date.now()
    const createdAt = new Date(item.fc).getTime()
    if (now - createdAt > EDIT_WINDOW_MS) {
        throw new TalentFlowError('El comentario solo puede editarse dentro de los 30 minutos de creado.', 403)
    }
}

/**
 * Crea un nuevo comentario en una etapa de vacante.
 * Auditoría: uc y um = usuario actual.
 * @param {Partial<VacanteEtapaComentario>} [input={}]
 * @returns {Promise<VacanteEtapaComentario>}
 */
async function post(input = {}) {
    try {
        const currentUser = getCurrentUser()
        const data = pick(input, ALLOWED_FIELDS_CREATE)
        if (!data.vacanteEtapaId) {
            throw new TalentFlowError('vacanteEtapaId es requerido.', 400)
        }
        if (!data.comentario || !String(data.comentario).trim()) {
            throw new TalentFlowError('comentario es requerido.', 400)
        }

        data.uc = currentUser.id
        data.um = currentUser.id

        const created = await prisma.vacanteEtapaComentario.create({ data })
        return created
    } catch (e) {
        throw mapPrismaError(e, { resource: 'VacanteEtapaComentario' })
    }
}

/**
 * Actualiza (PUT) el contenido de un comentario.
 * Reglas:
 *  - Solo puede editar el creador.
 *  - Solo hasta 30 minutos después de fc.
 *  - Solo campo permitido: comentario.
 * Auditoría: um = usuario actual.
 * @param {string} id
 * @param {Partial<VacanteEtapaComentario>} [input={}]
 * @returns {Promise<VacanteEtapaComentario>}
 */
async function put(id, input = {}) {
    try {
        const currentUser = getCurrentUser()

        // Cargamos el comentario para validar reglas de edición
        const existing = await prisma.vacanteEtapaComentario.findUnique({ where: { id } })
        assertCanEdit(existing, currentUser)

        const data = pick(input, ALLOWED_FIELDS_UPDATE)
        if (!data.comentario || !String(data.comentario).trim()) {
            throw new TalentFlowError('comentario es requerido.', 400)
        }

        data.um = currentUser.id

        const updated = await prisma.vacanteEtapaComentario.update({
            where: { id },
            data,
        })
        return updated
    } catch (e) {
        // Si no existe o viola FK/otros, cae en mapPrismaError. Las violaciones de reglas tiran TalentFlowError arriba.
        if (e instanceof TalentFlowError) throw e
        throw mapPrismaError(e, { resource: 'VacanteEtapaComentario' })
    }
}

/**
 * Lista comentarios de una VacanteEtapa ordenados por fc DESC, incluyendo datos del autor.
 * @param {string} vacanteEtapaId
 * @returns {Promise<{data: (VacanteEtapaComentario & { autor: { id: string, email: string|null, nombre: string|null, apellido: string|null } | null })[], meta: { total: number }}>}
 */
async function getByVacanteEtapaId(vacanteEtapaId) {
    // 1) Traemos los comentarios
    const rows = await prisma.vacanteEtapaComentario.findMany({
        where: { vacanteEtapaId },
        orderBy: { fc: 'desc' },
    })

    // 2) Resolvemos los autores (uc) únicos y buscamos sus datos
    const userIds = [...new Set(rows.map(r => r.uc).filter(Boolean))]
    const users = userIds.length
        ? await prisma.usuario.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, nombre: true, apellido: true },
        })
        : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // 3) Enriquecemos cada comentario con el objeto autor
    const data = rows.map(r => {
        const u = r.uc ? userMap.get(r.uc) : null
        let iniciales = null

        if (u) {
            const n = (u.nombre || '').trim()
            const a = (u.apellido || '').trim()
            iniciales =
                (n ? n.charAt(0).toUpperCase() : '') +
                (a ? a.charAt(0).toUpperCase() : '')
        }

        let fcLabel = dayjs(r.fc).format('ddd, DD [de] MMM [de] YYYY, HH:mm')

        return {
            ...r,
            fcLabel,
            autor: u
                ? {
                    id: u.id,
                    email: u.email ?? null,
                    nombre: u.nombre ?? null,
                    apellido: u.apellido ?? null,
                    iniciales, // 👈 agregado
                }
                : null,
        }
    })

    return {
        data,
        meta: { total: data.length },
    }
}

/**
 * Elimina un comentario por ID.
 * Regla: solo puede eliminar el usuario que lo creó (uc).
 *
 * @param {string} id - UUID del comentario.
 * @returns {Promise<import('@prisma/client').VacanteEtapaComentario>} Registro eliminado.
 * @throws {TalentFlowError} 403 si no es el creador; 404 si no existe.
 */
async function remove(id) {
    try {
        const currentUser = getCurrentUser()

        // 1) Buscar el comentario
        const existing = await prisma.vacanteEtapaComentario.findUnique({ where: { id } })
        if (!existing) {
            // P2025 es manejado por mapPrismaError, pero aquí damos un 404 explícito
            throw new TalentFlowError('El comentario no existe.', 404)
        }

        // 2) Validar autoría
        if (!existing.uc || existing.uc !== currentUser.id) {
            throw new TalentFlowError('No tenés permisos para eliminar este comentario.', 403)
        }

        // 3) Eliminar
        const deleted = await prisma.vacanteEtapaComentario.delete({ where: { id } })
        return deleted
    } catch (e) {
        if (e instanceof TalentFlowError) throw e
        throw mapPrismaError(e, { resource: 'VacanteEtapaComentario' })
    }
}


export const VacanteEtapaComentarioService = {
    post,
    put,
    remove,
    getByVacanteEtapaId,
}
