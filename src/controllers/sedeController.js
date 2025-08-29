import { validationResult } from 'express-validator'
import { SedeService } from '../services/sedeService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Sede} Sede */

/**
 * Lista sedes con paginación, búsqueda y ordenamiento.
 *
 * Query params admitidos:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'ciudad' | 'region' | 'pais' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - empresaId?: string (UUID)  ← opcional para filtrar por empresa
 *
 * @param {Request} req - Express request (usa `req.query`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getAll(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await SedeService.getByEmpresa()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Sedes listadas correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene una sede por su ID (UUID).
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

    const item = await SedeService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Sede obtenida correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea una nueva sede.
 * Auditoría (uc/um) se setea en el service con `getCurrentUser()`.
 *
 * Body esperado (según tu modelo):
 * - empresaId: string (UUID)  ← requerido
 * - nombre: string            ← requerido (valídalo en rutas)
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
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

    /** @type {Partial<Sede>} */
    const payload = req.body
    const created = await SedeService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Sede creada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente una sede existente.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido:
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
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

    /** @type {Partial<Sede>} */
    const payload = req.body
    const updated = await SedeService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Sede actualizada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina una sede por ID.
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

    const deleted = await SedeService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Sede eliminada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}


export const SedeController = {
  getAll,
  getById,
  post,
  patch,
  delete: remove,
}
