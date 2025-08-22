import express from 'express'
import empresaRoute from './empresaRoute.js'
import sedeRoute from './sedeRoute.js'
import departamentoRoute from './departamentoRoute.js'
import { authenticateJWT } from '../middlewares/authMiddleware.js'

/**
 * Enrutador raíz de la API.
 * Agrupa subrutas de autenticación, cuentas, inventario y empresas.
 *
 * @module routes/index
 * @returns {import('express').Router}
 */
const router = express.Router()

router.use('/empresas', authenticateJWT, empresaRoute)
router.use('/sedes', authenticateJWT, sedeRoute)
router.use('/departamentos', departamentoRoute)

export default router