import express from 'express'
import { body } from 'express-validator'
import { AuthController } from '../controllers/authController.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para autenticación: registro y login.
 *
 * @module routes/auth
 * @returns {Router}
 */
const router = express.Router()

/**
 * POST /auth/register
 * Registra un nuevo usuario con password hasheado.
 *
 * Body (requeridos):
 * - empresaId: UUID
 * - username: string
 * - email: email
 * - password: string (min 8)
 * - nombre: string
 * - apellido: string
 * - telefono: string
 *
 * Body (opcionales):
 * - departamentoId?: UUID
 * - sedeId?: UUID
 */
router.post(
  '/register',
  [
    body('empresaId').notEmpty().withMessage('empresaId es requerido').bail().isUUID().withMessage('empresaId debe ser UUID'),
    body('username').notEmpty().withMessage('username es requerido').bail().isString().trim(),
    body('email').notEmpty().withMessage('email es requerido').bail().isEmail().withMessage('email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('password es requerido').bail().isLength({ min: 8 }).withMessage('password mínimo 8 caracteres'),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('apellido').notEmpty().withMessage('apellido es requerido').bail().isString().trim(),
    body('telefono').notEmpty().withMessage('telefono es requerido').bail().isString().trim().matches(/^595\d{9}$/).withMessage('telefono debe iniciar con 595 y tener 12 dígitos'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
    body('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
  ],
  AuthController.register
)

/**
 * POST /auth/login
 * Inicia sesión con username o email + password.
 *
 * Body:
 * - username?: string
 * - email?: string
 * - password: string
 *
 * Reglas:
 * - Debe enviarse al menos `username` o `email`.
 */
router.post(
  '/login',
  [
    body('username').optional().isString().trim(),
    body('email').optional().isEmail().withMessage('email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('password es requerido'),
    // custom: al menos username o email
    body().custom(({ username, email }) => {
      if (!username && !email) throw new Error('Debe enviar username o email')
      return true
    }),
  ],
  AuthController.login
)

export default router
