// src/routes/usuarioRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { UsuarioController } from '../controllers/usuarioController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['username', 'email', 'nombre', 'apellido', 'fc', 'fm']

/**
 * Rutas para el recurso Usuario.
 *
 * @module routes/usuario
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /usuarios
 * Obtiene los usuarios de una empresa
 */
router.get(
  '',
  verifyRol(TF_ADMINS),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(['username','email','nombre','apellido','fc','fm']),
    query('order').optional().isIn(['asc','desc']),
    query('activo').optional().isBoolean().toBoolean(),
    query('sedeId').optional().isUUID(),
    query('departamentoId').optional().isUUID(),
  ],
  UsuarioController.get
)

/**
 * GET /usuarios/:id
 * Obtiene un usuario por ID (UUID).
 */
router.get(
  '/:id',
  verifyRol(TF_ADMINS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  UsuarioController.getById
)

/**
 * PATCH /usuarios/:id
 * Actualiza parcialmente un usuario.
 *
 * Body (cualquiera de estos campos; filtrado real en el service por ALLOWED_FIELDS):
 * - empresaId?: string (UUID)
 * - departamentoId?: string (UUID)
 * - sedeId?: string (UUID)
 * - nombre?: string
 * - apellido?: string
 * - telefono?: string
 */
router.patch(
  '/:id',
  verifyRol(TF_ADMINS),
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
    body('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
    body('rolId').isUUID().withMessage('rolId debe ser un UUID válido'),
    body('nombre').optional().isString().trim(),
    body('apellido').optional().isString().trim(),
    body('telefono').optional().isString().trim(),
  ],
  UsuarioController.patch
)

/**
 * DELETE /usuarios/:id
 * Desactiva (soft delete) un usuario.
 */
router.delete(
  '/:id',
  verifyRol(TF_ADMINS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  UsuarioController.delete
)

/**
 * POST /usuarios
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
  '',
  verifyRol(TF_ADMINS),
  [
    body('email').notEmpty().withMessage('email es requerido').bail().isEmail().withMessage('email inválido').normalizeEmail(),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('apellido').notEmpty().withMessage('apellido es requerido').bail().isString().trim(),
    body('telefono').notEmpty().withMessage('telefono es requerido').bail().isString().trim().matches(/^595\d{9}$/).withMessage('telefono debe iniciar con 595 y tener 12 dígitos'),
    body('rolId').isUUID().withMessage('rolId debe ser un UUID válido'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser un UUID válido'),
  ],
  UsuarioController.post
)

router.post(
  '/me/password',
  [
    body('pass').isString().isLength({ min: 8 }),
    body('pass').matches(/[0-9]/).withMessage('Debe incluir al menos un número'),
    body('pass').matches(/[^\w\s]/).withMessage('Debe incluir al menos un símbolo'),
    body('repeatPass').custom((v, { req }) => {
      if (v !== req.body.pass) throw new Error('Las contraseñas no coinciden')
      return true
    }),
  ],
  UsuarioController.updatePass
)

export default router
