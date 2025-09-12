// src/controllers/vacanteEtapaComentarioController.js
import { validationResult } from 'express-validator'
import { VacanteEtapaComentarioService } from '../services/vacanteEtapaComentarioService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').VacanteEtapaComentario} VacanteEtapaComentario */

/**
 * Lista comentarios de una VacanteEtapa (orden fc DESC), incluyendo autor {id, email, nombre, apellido}.
 *
 * Params:
 * - vacanteEtapaId: string (UUID) ← en req.params
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getByVacanteEtapaId(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const { vacanteEtapaId } = req.params
    const result = await VacanteEtapaComentarioService.getByVacanteEtapaId(vacanteEtapaId)

    return res
      .status(200)
      .send(new Response('success', 200, result, 'Comentarios listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea un comentario en una VacanteEtapa.
 * Auditoría (uc/um) se setea en el service con `getCurrentUser()`.
 *
 * Params:
 * - vacanteEtapaId: string (UUID) ← en req.params
 *
 * Body esperado:
 * - comentario: string ← requerido
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

    const { vacanteEtapaId } = req.params
    /** @type {Partial<VacanteEtapaComentario>} */
    const payload = {
      vacanteEtapaId,
      comentario: req.body?.comentario,
    }

    const created = await VacanteEtapaComentarioService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Comentario creado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza (PUT) el contenido de un comentario.
 * Reglas aplicadas en el service:
 *  - Solo puede editar el creador.
 *  - Solo hasta 30 minutos después de `fc`.
 *  - Campo permitido: comentario.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Params:
 * - id: string (UUID) ← en req.params
 *
 * Body permitido:
 * - comentario: string ← requerido
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function put(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const { id } = req.params
    /** @type {Partial<VacanteEtapaComentario>} */
    const payload = {
      comentario: req.body?.comentario,
    }

    const updated = await VacanteEtapaComentarioService.put(id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Comentario actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina un comentario por ID.
 * Reglas aplicadas en el service:
 *  - Solo puede eliminar el usuario que creó el comentario (uc).
 *
 * Params:
 * - id: string (UUID) ← en req.params
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

    const { id } = req.params
    const deleted = await VacanteEtapaComentarioService.remove(id)

    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Comentario eliminado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}


export const VacanteEtapaComentarioController = {
  getByVacanteEtapaId,
  post,
  put,
  remove
}
