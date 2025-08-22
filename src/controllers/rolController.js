// src/controllers/rolController.js
import { validationResult } from 'express-validator'
import { RolService } from '../services/rolService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Rol} Rol */

/**
 * Lista roles de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: string (UUID)
 *
 * Query params (opcionales):
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
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

    const result = await RolService.getByEmpresa(req.params.empresaId, req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Roles listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un rol por su ID (UUID).
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

    const item = await RolService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Rol obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea un nuevo rol (scoped por empresa).
 * Auditoría (uc/um) se setea en el service con `getCurrentUser()`.
 *
 * Body esperado:
 * - empresaId: string (UUID) ← requerido
 * - nombre: string           ← requerido
 * - descripcion?: string
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

    /** @type {Partial<Rol>} */
    const payload = req.body
    const created = await RolService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Rol creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente un rol existente.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido:
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - descripcion?: string
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

    /** @type {Partial<Rol>} */
    const payload = req.body
    const updated = await RolService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Rol actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Agrega y/o quita permisos a un rol.
 *
 * Path param:
 * - id: string (UUID) → rolId
 *
 * Body:
 * - add?: string[]    → IDs de permisos a agregar
 * - remove?: string[] → IDs de permisos a quitar
 *
 * @param {Request} req - Express request (usa `req.params.id` y `req.body`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function patchPermisos(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const { add, remove } = req.body ?? {}
    const result = await RolService.patchPermisos(req.params.id, { add, remove })
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Permisos del rol actualizados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina un rol por ID.
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

    const deleted = await RolService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Rol eliminado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { RolController } from '../controllers/rolController.js'`
 */
export const RolController = {
  getByEmpresa,
  getById,
  post,
  patch,
  patchPermisos,
  delete: remove,
}
