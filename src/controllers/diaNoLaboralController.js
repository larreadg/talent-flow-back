// src/controllers/diaNoLaboralController.js
import { validationResult } from 'express-validator'
import { DiaNoLaboralService } from '../services/diaNoLaboralService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').DiaNoLaboral} DiaNoLaboral */

/**
 * Lista días no laborales visibles para el usuario actual:
 * - Nacionales (tipo = 'nacional')
 * - De la empresa del usuario (tipo = 'empresa' y empresaId = currentUser.empresaId)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getAll(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await DiaNoLaboralService.getAll()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Días no laborales listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un día no laboral por ID.
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const item = await DiaNoLaboralService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Día no laboral obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea un día no laboral.
 * Auditoría (uc/um) y empresaId se setean en el service con `getCurrentUser()`.
 *
 * Body esperado:
 * - tipo: 'nacional' | 'empresa' (enum)
 * - nombre: string
 * - fecha: string (YYYY-MM-DD)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function post(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<DiaNoLaboral>} */
    const payload = req.body
    const created = await DiaNoLaboralService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Día no laboral creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente un día no laboral.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido:
 * - tipo?: 'nacional' | 'empresa'
 * - nombre?: string
 * - fecha?: string (YYYY-MM-DD)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function patch(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<DiaNoLaboral>} */
    const payload = req.body
    const updated = await DiaNoLaboralService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Día no laboral actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Soft delete: marca como inactivo el día no laboral.
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function remove(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const deleted = await DiaNoLaboralService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Día no laboral eliminado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const DiaNoLaboralController = {
  getAll,
  getById,
  post,
  patch,
  delete: remove,
}
