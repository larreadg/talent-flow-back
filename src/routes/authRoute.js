import express from 'express'
import { body } from 'express-validator'
import { AuthController } from '../controllers/authController.js'
import { CaptchaController } from '../controllers/captchaController.js'
import { authenticateJWT } from '../middlewares/authMiddleware.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para autenticación: registro y login.
 *
 * @module routes/auth
 * @returns {Router}
 */
const router = express.Router()

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
    body('email').isEmail().withMessage('email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('password es requerido'),
    body('captcha').notEmpty().withMessage('captcha es requerido')
  ],
  AuthController.login
)

/**
 * GET /auth/captcha
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
router.get(
  '/captcha',
  CaptchaController.get
)

router.post(
  '/me/password',
  authenticateJWT,
  [
    body('pass').isString().isLength({ min: 8 }),
    body('pass').matches(/[0-9]/).withMessage('Debe incluir al menos un número'),
    body('pass').matches(/[^\w\s]/).withMessage('Debe incluir al menos un símbolo'),
    body('repeatPass').custom((v, { req }) => {
      if (v !== req.body.pass) throw new Error('Las contraseñas no coinciden')
      return true
    }),
  ],
  AuthController.updatePass
)

export default router
