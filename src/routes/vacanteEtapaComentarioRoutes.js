// src/routes/vacanteEtapaComentarioRoutes.js
import express from 'express'
import { body, param } from 'express-validator'
import { VacanteEtapaComentarioController } from '../controllers/vacanteEtapaComentarioController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para el recurso Comentarios de VacanteEtapa.
 *
 * Convenciones:
 * - GET  /vacantes-etapas/:vacanteEtapaId/comentarios
 * - POST /vacantes-etapas/:vacanteEtapaId/comentarios
 * - PUT  /vacantes-etapas/comentarios/:id
 *
 * @module routes/vacanteEtapaComentario
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /vacantes-etapas/:vacanteEtapaId/comentarios
 * Lista comentarios de una VacanteEtapa (orden fc DESC), incluyendo datos del autor.
 */
router.get(
  '/:vacanteEtapaId',
  verifyRol(TF_ADMINS),
  [
    param('vacanteEtapaId').isUUID().withMessage('vacanteEtapaId debe ser un UUID válido'),
  ],
  VacanteEtapaComentarioController.getByVacanteEtapaId
)

/**
 * Elimina un comentario.
 */
router.delete(
  '/:id',
  verifyRol(TF_ADMINS),
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
  ],
  VacanteEtapaComentarioController.remove
)

/**
 * POST /vacantes-etapas/:vacanteEtapaId/comentarios
 * Crea un comentario en una VacanteEtapa.
 *
 * Body:
 * - comentario: string ← requerido
 */
router.post(
  '/:vacanteEtapaId',
  verifyRol(TF_ADMINS),
  [
    param('vacanteEtapaId').isUUID().withMessage('vacanteEtapaId debe ser un UUID válido'),
    body('comentario')
      .notEmpty().withMessage('comentario es requerido')
      .bail()
      .isString().withMessage('comentario debe ser string')
      .trim(),
  ],
  VacanteEtapaComentarioController.post
)

/**
 * PUT /vacantes-etapas/comentarios/:id
 * Actualiza el contenido de un comentario.
 *
 * Body:
 * - comentario: string ← requerido
 */
router.put(
  '/:id',
  verifyRol(TF_ADMINS),
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('comentario')
      .notEmpty().withMessage('comentario es requerido')
      .bail()
      .isString().withMessage('comentario debe ser string')
      .trim(),
  ],
  VacanteEtapaComentarioController.put
)

export default router
