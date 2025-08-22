import { validationResult } from 'express-validator'
import { EmpresaService } from '../services/empresaService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Empresa} Empresa */

/**
 * Lista empresas con paginación/búsqueda/ordenamiento.
 *
 * @param {Request} req - Request de Express (usa query: page, pageSize, q, orderBy, order).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<void>}
 */
async function getAllController(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await EmpresaService.getAll(req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Empresas listadas correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene una empresa por su ID.
 *
 * @param {Request} req - Request de Express (usa params.id).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<void>}
 */
async function getByIdController(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const empresa = await EmpresaService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, empresa, 'Empresa obtenida correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crea una nueva empresa.
 * La auditoría (uc/um) se setea dentro del servicio con el usuario del contexto.
 *
 * @param {Request} req - Request de Express (usa body: { nombre, razonSocial, ruc, estado }).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<void>}
 */
async function postController(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<Empresa>} */
    const payload = req.body
    const created = await EmpresaService.post(payload)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Empresa creada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente una empresa existente.
 * La auditoría (um) se setea dentro del servicio con el usuario del contexto.
 *
 * @param {Request} req - Request de Express (usa params.id y body con campos a actualizar).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<void>}
 */
async function patchController(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    /** @type {Partial<Empresa>} */
    const payload = req.body
    const updated = await EmpresaService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Empresa actualizada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Elimina una empresa por ID.
 *
 * @param {Request} req - Request de Express (usa params.id).
 * @param {ExpressResponse} res - Response de Express.
 * @returns {Promise<void>}
 */
async function deleteController(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const deleted = await EmpresaService.delete(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Empresa eliminada exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const EmpresaController = {
  getAll: getAllController,
  getById: getByIdController,
  post: postController,
  patch: patchController,
  delete: deleteController,
}
