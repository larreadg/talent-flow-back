// src/controllers/procesoController.js
import { validationResult } from 'express-validator'
import { ProcesoService } from '../services/procesoService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Proceso} Proceso */

/**
 * GET /procesos
 * Lista procesos de la empresa del usuario actual.
 * Incluye sus etapas (ordenadas) según lo definido en el service.
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

    const result = await ProcesoService.getByEmpresa()
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Procesos listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * POST /procesos
 * Crea un proceso para la empresa del usuario actual y sus etapas (ProcesoEtapa).
 *
 * Body esperado:
 * - nombre: string                     ← requerido
 * - descripcion?: string               ← opcional
 * - etapas: Array<{etapaId, orden}>    ← requerido (no vacío)
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

    /** @type {Partial<Proceso> & { etapas: Array<{ etapaId: string, orden: number }> }} */
    const payload = req.body
    const created = await ProcesoService.post(payload)

    return res
      .status(201)
      .send(new Response('success', 201, created, 'Proceso creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { ProcesoController } from '../controllers/procesoController.js'`
 */
export const ProcesoController = {
  getAll,
  post,
}
