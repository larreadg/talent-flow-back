// src/controllers/usuarioController.js
import { validationResult } from 'express-validator'
import { UsuarioService } from '../services/usuarioService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */
/** @typedef {import('@prisma/client').Usuario} Usuario */

/**
 * Lista usuarios de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: string (UUID)
 *
 * Query params (opcionales) — se pasan directo al service:
 * - page?: number (default 1)
 * - pageSize?: number (default 25)
 * - q?: string (busca en username, email, nombre, apellido, telefono)
 * - orderBy?: 'username' | 'email' | 'nombre' | 'apellido' | 'fc' | 'fm' (default 'username')
 * - order?: 'asc' | 'desc' (default 'asc')
 * - activo?: boolean
 * - sedeId?: string (UUID)
 * - departamentoId?: string (UUID)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getByEmpresa(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await UsuarioService.getByEmpresa(req.params.empresaId, req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Usuarios listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Lista usuarios de un departamento con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - departamentoId: string (UUID)
 *
 * Query params (opcionales) — se pasan directo al service:
 * - page?: number (default 1)
 * - pageSize?: number (default 25)
 * - q?: string
 * - orderBy?: 'username' | 'email' | 'nombre' | 'apellido' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - activo?: boolean
 * - sedeId?: string (UUID)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function getByDepartamento(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await UsuarioService.getByDepartamento(req.params.departamentoId, req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Usuarios listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene un usuario por su ID (UUID).
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

    const item = await UsuarioService.getById(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, item, 'Usuario obtenido correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Actualiza parcialmente un usuario existente.
 * Auditoría (um) se setea en el service con `getCurrentUser()`.
 *
 * Body permitido (filtrado en el service por ALLOWED_FIELDS):
 * - empresaId?: string (UUID)
 * - departamentoId?: string (UUID)
 * - sedeId?: string (UUID)
 * - nombre?: string
 * - apellido?: string
 * - telefono?: string
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

    /** @type {Partial<Usuario>} */
    const payload = req.body
    const updated = await UsuarioService.patch(req.params.id, payload)
    return res
      .status(200)
      .send(new Response('success', 200, updated, 'Usuario actualizado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Desactiva (soft delete) un usuario por ID (`activo=false`).
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

    const deleted = await UsuarioService.remove(req.params.id)
    return res
      .status(200)
      .send(new Response('success', 200, deleted, 'Usuario desactivado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Obtiene usuarios por la empresa del usuario logueado
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function get(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await UsuarioService.get(req.query)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Usuarios listados correctamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Crear un usuario inactivo
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

    await UsuarioService.post(req.body)
    return res
      .status(200)
      .send(new Response('success', 201, null, 'Usuario creado'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Resetea una contraseña
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function updatePass(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await UsuarioService.updatePass(req.body)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Contraseña actualizada'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

export const UsuarioController = {
  getByEmpresa,
  getByDepartamento,
  get,
  getById,
  patch,
  delete: remove,
  post,
  updatePass
}
