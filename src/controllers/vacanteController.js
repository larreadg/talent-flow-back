// src/controllers/vacanteController.js
import { validationResult } from 'express-validator'
import { VacanteService } from '../services/vacanteService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Vacante} Vacante */

/**
 * GET /vacantes
 * Lista vacantes de la empresa del usuario actual.
 * Soporta paginación (limit, offset) y filtro por texto (filter).
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getAll(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, null, errors.array()))
    }

    const { limit, offset, filter, sortBy, sortDir, estados, departamentos, sedes } = req.query

    const result = await VacanteService.getByEmpresa({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter: filter ?? null,
      sortBy: sortBy ?? null,
      sortDir: sortDir ?? null,
      estados: estados ?? null,
      departamentos: departamentos ?? null,
      sedes: sedes ?? null,
    })

    return res
      .status(200)
      .send(new Response('success', 200, result, 'Vacantes listadas correctamente'))
  } catch (e) {
    console.log(e)
    if (e instanceof TalentFlowError) {
      return res
        .status(e.code)
        .send(new Response('error', e.code, null, e.message))
    }
    return res
      .status(500)
      .send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * POST /vacantes
 * Crea una vacante y genera sus VacanteEtapa según el ProcesoEtapa,
 * calculando fechas hábiles e ignorando feriados.
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
  
      const payload = /** @type {{ nombre:string, procesoId:string, fechaInicio:string, departamentoId?:string|null, aumentoDotancion:boolean }} */ (req.body)
      const created = await VacanteService.post(payload)
  
      return res
        .status(201)
        .send(new Response('success', 201, created, 'Vacante creada exitosamente'))
    } catch (e) {
      if (e instanceof TalentFlowError) {
        return res.status(e.code).send(new Response('error', e.code, null, e.message))
      }
      return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
    }
}

/**
 * PATCH /vacantes/:id
 * Modifica campos permitidos y, si cambia fechaInicio, recalcula etapas.
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

    const { id } = req.params
    const payload = /** @type {{ nombre?:string, departamentoId?:string|null, sedeId?:string|null, fechaInicio?:string, aumentoDotancion:boolean, resultado:'promocion_interna', 'traslado', 'contratacion_externa' }} */ (req.body)

    const updated = await VacanteService.patch(id, payload)

    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Vacante actualizada correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * GET /vacantes/estados
 * Obtener vacantes por estados agrupados.
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getResumenPorEstado(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const data = await VacanteService.getResumenPorEstado()

    return res
      .status(200)
      .send(new Response('success', 200, data, 'Vacantes agrupadas obtenidas'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene una vacante por su ID (UUID).
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

    const item = await VacanteService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Vacante obtenida correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * POST /vacantes/completar-etapa
 * Cierra una etapa y recalcula n + 1 etapas
 * calculando fechas hábiles e ignorando feriados.
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function completarEtapa(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const payload = /** @type {{ id: string, fechaCumplimiento: string }} */ (req.body)
    const changed = await VacanteService.completarEtapa(payload)

    return res
      .status(201)
      .send(new Response('success', 201, changed, 'Vacante actualizada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const VacanteController = {
  getAll,
  post,
  patch,
  getResumenPorEstado,
  getById,
  completarEtapa
}
