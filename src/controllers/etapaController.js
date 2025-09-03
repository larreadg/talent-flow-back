// src/controllers/etapaController.js
import { validationResult } from 'express-validator'
import { EtapaService } from '../services/etapaService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Etapa} Etapa */

/**
 * Lista etapas de la empresa del usuario actual.
 *
 * Query params admitidos:
 * - onlyActive?: boolean  (ej: ?onlyActive=true para filtrar activo=true)
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

    const onlyActive = String(req.query.onlyActive ?? '').toLowerCase() === 'true'
    const result = await EtapaService.getByEmpresa({ onlyActive })

    return res
      .status(200)
      .send(new Response('success', 200, result, 'Etapas listadas correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea una nueva etapa (global por empresa).
 * Auditoría (uc/um) y empresaId se setean en el service con `getCurrentUser()`.
 *
 * Body esperado:
 * - nombre: string            ← requerido
 * - slaDias: number           ← requerido (entero >= 0)
 * - activo?: boolean          ← opcional (default true)
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

    /** @type {Partial<Etapa>} */
    const payload = req.body
    const created = await EtapaService.post(payload)

    return res
      .status(201)
      .send(new Response('success', 201, created, 'Etapa creada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { EtapaController } from '../controllers/etapaController.js'`
 */
export const EtapaController = {
  getAll,
  post,
}
