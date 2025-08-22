// src/controllers/authController.js
import { validationResult } from 'express-validator'
import { AuthService } from '../services/authService.js'
import { TalentFlowError } from '../utils/error.js'
import { Response } from '../utils/response.js'

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} ExpressResponse */

/**
 * Registra un nuevo usuario con password hasheado.
 *
 * Body requerido:
 * - empresaId: string (UUID)
 * - username: string
 * - email: string
 * - password: string
 * - nombre: string
 * - apellido: string
 * - telefono: string
 *
 * Body opcional:
 * - departamentoId?: string (UUID)
 * - sedeId?: string (UUID)
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function register(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const created = await AuthService.registerUsuario(req.body)
    return res
      .status(201)
      .send(new Response('success', 201, created, 'Usuario registrado exitosamente'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Inicia sesión con username o email + password.
 * Retorna un JWT firmado y los datos públicos del usuario.
 *
 * Body:
 * - username?: string
 * - email?: string
 * - password: string
 *
 * Respuesta:
 * - { token: string, user: { id, empresaId, ..., activo, fc, fm } }
 *
 * @param {Request} req
 * @param {ExpressResponse} res
 * @returns {Promise<void>}
 */
async function login(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).send(new Response('error', 400, null, errors.array()))
    }

    const result = await AuthService.login(req.body)
    return res
      .status(200)
      .send(new Response('success', 200, result, 'Login exitoso'))
  } catch (e) {
    if (e instanceof TalentFlowError) {
      return res.status(e.code).send(new Response('error', e.code, null, e.message))
    }
    return res.status(500).send(new Response('error', 500, null, e.message || 'Server error'))
  }
}

/**
 * Objeto agrupador para importar un único controlador:
 * `import { AuthController } from '../controllers/authController.js'`
 */
export const AuthController = {
  register,
  login,
}
