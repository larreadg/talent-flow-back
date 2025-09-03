// src/routes/diaNoLaboralRoute.js
import express from 'express'
import { body, param } from 'express-validator'
import { DiaNoLaboralController } from '../controllers/diaNoLaboralController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS, TF_ALL_ROLS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

const router = express.Router()

/**
 * GET /dias-no-laborales
 * Lista días no laborales visibles (nacionales + de la empresa del usuario actual).
 */
router.get(
  '/',
  verifyRol(TF_ALL_ROLS),
  DiaNoLaboralController.getAll
)

/**
 * GET /dias-no-laborales/:id
 * Obtiene un día no laboral por ID (UUID).
 */
router.get(
  '/:id',
  verifyRol(TF_ALL_ROLS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  DiaNoLaboralController.getById
)

/**
 * POST /dias-no-laborales
 * Crea un día no laboral.
 *
 * Body:
 * - tipo: 'nacional' | 'empresa' (requerido)
 * - nombre: string (requerido)
 * - fecha: string 'YYYY-MM-DD' (requerido)
 */
router.post(
  '/',
  verifyRol(TF_ADMINS),
  [
    body('tipo')
      .notEmpty().withMessage('tipo es requerido').bail()
      .isIn(['nacional', 'empresa']).withMessage("tipo debe ser 'nacional' o 'empresa'"),
    body('nombre')
      .notEmpty().withMessage('nombre es requerido').bail()
      .isString().withMessage('nombre debe ser string')
      .trim(),
    body('fecha')
      .notEmpty().withMessage('fecha es requerida').bail()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha debe tener formato 'YYYY-MM-DD'")
  ],
  DiaNoLaboralController.post
)

/**
 * PATCH /dias-no-laborales/:id
 * Actualiza parcialmente un día no laboral.
 *
 * Body (cualquiera de estos campos):
 * - tipo?: 'nacional' | 'empresa'
 * - nombre?: string
 * - fecha?: string 'YYYY-MM-DD'
 */
router.patch(
  '/:id',
  verifyRol(TF_ADMINS),
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('tipo')
      .optional()
      .isIn(['nacional', 'empresa']).withMessage("tipo debe ser 'nacional' o 'empresa'"),
    body('nombre')
      .optional()
      .isString().withMessage('nombre debe ser string')
      .trim(),
    body('fecha')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha debe tener formato 'YYYY-MM-DD'"),
  ],
  DiaNoLaboralController.patch
)

/**
 * DELETE /dias-no-laborales/:id
 * Soft delete (marca como inactivo).
 */
router.delete(
  '/:id',
  verifyRol(TF_ADMINS),
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  DiaNoLaboralController.delete
)

export default router
