import express from 'express'
import empresaRoute from './empresaRoute.js'
import sedeRoute from './sedeRoute.js'
import departamentoRoute from './departamentoRoute.js'
import permisoRoute from './permisoRoute.js'
import rolRoute from './rolRoute.js'
import equipoRoute from './equipoRoute.js'
import usuarioRoute from './usuarioRoute.js'
import authRoute from './authRoute.js'
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
router.use('/permisos', authenticateJWT, permisoRoute)
router.use('/roles', authenticateJWT, rolRoute)
router.use('/equipos', authenticateJWT, equipoRoute)
router.use('/usuarios', authenticateJWT, usuarioRoute)

export default router