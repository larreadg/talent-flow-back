import { validationResult } from 'express-validator'
import { PermisoService } from '../services/permisoService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Permiso} Permiso */

/**
 * Lista permisos con paginación, búsqueda y ordenamiento.
 *
 * Query params admitidos:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'clave' | 'recurso' | 'accion' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
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

    const result = await PermisoService.getAll(req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Permisos listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un permiso por su ID (UUID).
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

    const item = await PermisoService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Permiso obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Lista permisos asociados a un rol específico.
 *
 * Path param:
 * - rolId: string (UUID)
 *
 * Query params (opcionales):
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'clave' | 'recurso' | 'accion' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 *
 * @param {Request} req - Express request (usa `req.params.rolId` y `req.query`).
 * @param {ExpressResponse} res - Express response.
 * @returns {Promise<void>}
 */
async function getByRol(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await PermisoService.getByRol(req.params.rolId, req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Permisos del rol listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const PermisoController = {
  getAll,
  getById,
  getByRol,
}
