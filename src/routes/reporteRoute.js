// routes/index.js
import express from 'express'
import { ReporteController } from '../controllers/reporteController.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { TF_ADMINS, TF_ALL_ROLS } from '../utils/utils.js'
import { param } from 'express-validator'

const router = express.Router()

router.get(
    '',
    verifyRol(TF_ADMINS),
    ReporteController.descargarReporteVacantes 
)

router.get(
    '/cumplimiento-sla-maximo',
    verifyRol(TF_ALL_ROLS),
    ReporteController.getSLAResumenMaximo 
)

router.get(
    '/vacantes-ultimo-anho',
    verifyRol(TF_ALL_ROLS),
    ReporteController.getResumenVacantesMensualUltimos12Meses 
)

router.get(
    '/top-incumplimiento/:limit',
    verifyRol(TF_ALL_ROLS),
    [
        param('limit')
        .notEmpty()
        .withMessage('limit es requerido')
        .bail()
        .isNumeric(),
    ],
    ReporteController.getTopDepartamentosIncumplimientoEtapas 
)

router.get(
    '/promedio-finalizacion',
    verifyRol(TF_ALL_ROLS),
    ReporteController.getPromedioDiasFinalizacion 
)

router.get(
    '/resultados-busquedas',
    verifyRol(TF_ALL_ROLS),
    ReporteController.getResumenResultadosDeBusqueda 
)

export default router
