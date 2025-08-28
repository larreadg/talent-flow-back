import express from 'express'
import { RolController } from '../controllers/rolController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS } from '../utils/utils.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para el recurso Rol (scoped por empresa).
 *
 * @module routes/rol
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /roles
 * Lista roles
 */
router.get(
  '',
  verifyRol(TF_ADMINS),
  RolController.get
)

export default router
