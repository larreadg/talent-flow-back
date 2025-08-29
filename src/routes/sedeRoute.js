// src/routes/sedeRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { SedeController } from '../controllers/sedeController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS, TF_ALL_ROLS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

// Valores permitidos de ordenamiento (deben coincidir con el service/controller)
const ORDER_FIELDS = ['nombre', 'ciudad', 'region', 'pais', 'fc', 'fm']

/**
 * Rutas para el recurso Sede.
 *
 * Convenciones:
 * - Validaciones con `express-validator` (los errores se manejan en el controller).
 * - Todas las rutas responden mediante el helper `Response` dentro del controller.
 *
 * @module routes/sede
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /sedes
 * Lista sedes por empresa del usuario
 *
 */
router.get(
  '/',
  verifyRol(TF_ALL_ROLS),
  SedeController.getAll
)

/**
 * GET /sedes/:id
 * Obtiene una sede por ID (UUID).
 */
router.get(
  '/:id',
  verifyRol(TF_ALL_ROLS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  SedeController.getById
)

/**
 * POST /sedes
 * Crea una nueva sede.
 *
 * Body:
 * - empresaId: string (UUID)  ← requerido
 * - nombre: string            ← requerido
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
 */
router.post(
  '/',
  verifyRol(TF_ADMINS),
  [
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('direccion').notEmpty().withMessage('direccion es requerido').bail().isString().trim(),
    body('ciudad').notEmpty().withMessage('ciudad es requerido').bail().isString().trim(),
    body('pais').notEmpty().withMessage('pais es requerido').bail().isString().trim(),
  ],
  SedeController.post
)

/**
 * PATCH /sedes/:id
 * Actualiza parcialmente una sede existente.
 *
 * Body (cualquiera de estos campos):
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
 */
router.patch(
  '/:id',
  verifyRol(TF_ADMINS),
  [
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('direccion').notEmpty().withMessage('direccion es requerido').bail().isString().trim(),
    body('ciudad').notEmpty().withMessage('ciudad es requerido').bail().isString().trim(),
    body('pais').notEmpty().withMessage('pais es requerido').bail().isString().trim(),
  ],
  SedeController.patch
)

/**
 * DELETE /sedes/:id
 * Elimina una sede por ID.
 */
router.delete(
  '/:id',
  verifyRol(TF_ADMINS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  SedeController.delete
)

export default router
