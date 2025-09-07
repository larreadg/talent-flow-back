// src/routes/procesoRoute.js
import express from 'express'
import { body } from 'express-validator'
import { ProcesoController } from '../controllers/procesoController.js'
import { TF_ADMINS } from '../utils/utils.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para el recurso Proceso (global por empresa).
 *
 * @module routes/proceso
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /procesos
 * Lista procesos de la empresa del usuario actual.
 * Incluye etapas (ordenadas) según el service.
 */
router.get('/', verifyRol(TF_ADMINS), ProcesoController.getAll)

/**
 * POST /procesos
 * Crea un proceso para la empresa del usuario actual y sus etapas.
 *
 * Body:
 * - nombre: string (requerido)
 * - descripcion?: string
 * - etapas: Array<{ etapaId: string, orden: number }> (requerido, no vacío)
 */
router.post(
  '/',
  verifyRol(TF_ADMINS),
  [
    body('nombre')
      .notEmpty()
      .withMessage('nombre es requerido')
      .bail()
      .isString()
      .trim(),
    body('descripcion').optional().isString().trim(),
    body('etapas')
      .isArray({ min: 1 })
      .withMessage('etapas debe ser un array con al menos un elemento'),
    body('etapas.*.etapaId')
      .notEmpty()
      .withMessage('Cada elemento de etapas debe tener etapaId')
      .bail()
      .isUUID()
      .withMessage('etapaId debe ser un UUID válido'),
    body('etapas.*.orden')
      .notEmpty()
      .withMessage('Cada elemento de etapas debe tener orden')
      .bail()
      .isInt({ min: 1 })
      .withMessage('orden debe ser un entero >= 1')
      .toInt(),
  ],
  ProcesoController.post
)

export default router
