import express from 'express'
import { body } from 'express-validator'
import { AuthController } from '../controllers/authController.js'
import { CaptchaController } from '../controllers/captchaController.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para autenticación: registro y login.
 *
 * @module routes/auth
 * @returns {Router}
 */
const router = express.Router()

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('password es requerido'),
    body('captcha').notEmpty().withMessage('captcha es requerido')
  ],
  AuthController.login
)

router.post(
  '/activate-account',
  [
    body('pass').isString().isLength({ min: 8 }),
    body('pass').matches(/[0-9]/).withMessage('Debe incluir al menos un número'),
    body('pass').matches(/[^\w\s]/).withMessage('Debe incluir al menos un símbolo'),
    body('repeatPass').custom((v, { req }) => {
      if (v !== req.body.pass) throw new Error('Las contraseñas no coinciden')
      return true
    }),
    body('captcha').notEmpty().withMessage('captcha es requerido'),
    body('token').notEmpty().withMessage('token es requerido')
  ],
  AuthController.activateAccount
)

router.post(
  '/reset-account',
  [
    body('pass').isString().isLength({ min: 8 }),
    body('pass').matches(/[0-9]/).withMessage('Debe incluir al menos un número'),
    body('pass').matches(/[^\w\s]/).withMessage('Debe incluir al menos un símbolo'),
    body('repeatPass').custom((v, { req }) => {
      if (v !== req.body.pass) throw new Error('Las contraseñas no coinciden')
      return true
    }),
    body('captcha').notEmpty().withMessage('captcha es requerido'),
    body('token').notEmpty().withMessage('token es requerido')
  ],
  AuthController.resetAccount
)

router.post(
  '/reset-account/request',
  [
    body('email').isEmail().withMessage('email inválido').normalizeEmail(),
    body('captcha').notEmpty().withMessage('captcha es requerido')
  ],
  AuthController.resetAccountRequest
)

router.get(
  '/captcha',
  CaptchaController.get
)

export default router
