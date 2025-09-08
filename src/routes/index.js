import express from 'express'
import empresaRoute from './empresaRoute.js'
import sedeRoute from './sedeRoute.js'
import departamentoRoute from './departamentoRoute.js'
import rolRoute from './rolRoute.js'
import usuarioRoute from './usuarioRoute.js'
import authRoute from './authRoute.js'
import diaNoLaboralRoute from './diaNoLaboralRoute.js'
import etapaRoute from './etapaRoute.js'
import procesoRoute from './procesoRoute.js'
import vacanteRoute from './vacanteRoute.js'
import { authenticateJWT } from '../middlewares/authMiddleware.js'

/**
 * Enrutador raíz de la API.
 * Agrupa subrutas de autenticación, cuentas, inventario y empresas.
 *
 * @module routes/index
 * @returns {import('express').Router}
 */
const router = express.Router()


// Rutas públicas (sin JWT)
router.use('/auth', authRoute)

// Rutas protegidas
router.use('/empresas', authenticateJWT, empresaRoute)
router.use('/sedes', authenticateJWT, sedeRoute)
router.use('/departamentos', authenticateJWT, departamentoRoute)
router.use('/roles', authenticateJWT, rolRoute)
router.use('/usuarios', authenticateJWT, usuarioRoute)
router.use('/dia-no-laboral', authenticateJWT, diaNoLaboralRoute)
router.use('/etapas', authenticateJWT, etapaRoute)
router.use('/procesos', authenticateJWT, procesoRoute)
router.use('/vacantes', authenticateJWT, vacanteRoute)

export default router