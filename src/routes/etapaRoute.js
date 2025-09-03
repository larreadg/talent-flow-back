// src/routes/etapaRoute.js
import express from 'express'
import { body } from 'express-validator'
import { EtapaController } from '../controllers/etapaController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para el recurso Etapa (global por empresa).
 *
 * @module routes/etapa
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /etapas
 * Lista etapas de la empresa del usuario actual.
 *
 * Query params:
 * - onlyActive?: boolean (true|false)
 */
router.get(
  '/',
  verifyRol(TF_ADMINS),
  EtapaController.getAll
)

/**
 * POST /etapas
 * Crea una etapa (global por empresa).
 *
 * Body:
 * - nombre: string           ← requerido
 * - slaDias: number          ← requerido (entero >= 0)
 * - activo?: boolean         ← opcional (default true en el service si no se envía)
 */
router.post(
  '/',
  verifyRol(TF_ADMINS),
  [
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('slaDias')
      .notEmpty().withMessage('slaDias es requerido').bail()
      .isInt({ min: 0 }).withMessage('slaDias debe ser un entero >= 0')
      .toInt(),
    body('activo').optional().isBoolean().withMessage('activo debe ser booleano').toBoolean(),
  ],
  EtapaController.post
)

export default router
