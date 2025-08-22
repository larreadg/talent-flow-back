// src/controllers/equipoController.js
import { validationResult } from 'express-validator'
import { EquipoService } from '../services/equipoService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Equipo} Equipo */

/**
 * Lista equipos de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: string (UUID)
 *
 * Query params (opcionales):
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'codigo' | 'tipo' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - sedeId?: string (UUID)
 * - departamentoId?: string (UUID)
 *
 * @param {Request} req - Express request (usa `req.params.empresaId` y `req.query`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getByEmpresa(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await EquipoService.getByEmpresa(req.params.empresaId, req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Equipos listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un equipo por su ID (UUID).
 *
 * @param {Request} req - Express request (usa `req.params.id`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const item = await EquipoService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Equipo obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea un nuevo equipo (scopeado por empresa y sede).
 * Auditoría (uc/um) se setea en el service con `getCurrentUser()`.
 *
 * Body esperado:
 * - empresaId: string (UUID) ← requerido
 * - sedeId: string (UUID)    ← requerido
 * - departamentoId?: string (UUID)
 * - nombre: string           ← requerido
 * - codigo?: string
 * - tipo?: string
 *
 * @param {Request} req - Express request (usa `req.body`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function post(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<Equipo>} */
    const payload = req.body
    const created = await EquipoService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Equipo creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente un equipo existente.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido:
 * - empresaId?: string (UUID)
 * - sedeId?: string (UUID)
 * - departamentoId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - tipo?: string
 *
 * @param {Request} req - Express request (usa `req.params.id` y `req.body`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function patch(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<Equipo>} */
    const payload = req.body
    const updated = await EquipoService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Equipo actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina un equipo por ID.
 *
 * @param {Request} req - Express request (usa `req.params.id`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function remove(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const deleted = await EquipoService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Equipo eliminado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { EquipoController } from '../controllers/equipoController.js'`
 */
export const EquipoController = {
  getByEmpresa,
  getById,
  post,
  patch,
  delete: remove,
}
