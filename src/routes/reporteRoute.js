// routes/index.js
import express from 'express'
import { ReporteController } from '../controllers/reporteController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS } from '../utils/utils.js'

const router = express.Router()

router.get(
    '',
    verifyRol(TF_ADMINS),
    ReporteController.descargarReporteVacantes 
)

export default router
