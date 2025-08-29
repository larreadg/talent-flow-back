import { validationResult } from 'express-validator'
import { DepartamentoService } from '../services/departamentoService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Departamento} Departamento */

/**
 * Lista departamentos con paginación, búsqueda y ordenamiento.
 *
 * Query params admitidos:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'codigo' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - empresaId?: string (UUID) ← opcional para filtrar por empresa
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

    const result = await DepartamentoService.getByEmpresa()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Departamentos listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un departamento por su ID (UUID).
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

    const item = await DepartamentoService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Departamento obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea un nuevo departamento (global por empresa).
 * Auditoría (uc/um) se setea en el service con `getCurrentUser()`.
 *
 * Body esperado:
 * - empresaId: string (UUID)  ← requerido
 * - nombre: string            ← requerido
 * - codigo?: string
 * - parentId?: string (UUID)
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

    /** @type {Partial<Departamento>} */
    const payload = req.body
    const created = await DepartamentoService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Departamento creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente un departamento.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido:
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - parentId?: string (UUID)
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

    /** @type {Partial<Departamento>} */
    const payload = req.body
    const updated = await DepartamentoService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Departamento actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina un departamento por ID.
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

    const deleted = await DepartamentoService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Departamento eliminado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { DepartamentoController } from '../controllers/departamentoController.js'`
 */
export const DepartamentoController = {
  getAll,
  getById,
  post,
  patch,
  delete: remove,
}
