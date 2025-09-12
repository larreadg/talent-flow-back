import express from 'express'
import { VacanteController } from '../controllers/vacanteController.js'
import { TF_ADMINS, TF_ALL_ROLS } from '../utils/utils.js'
import { verifyRol } from '../middlewares/roleMiddleware.js'
import { body, param, query } from 'express-validator'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para vacantes (global por empresa).
 *
 * @module routes/proceso
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /vacantes
 * Lista vacantes de la empresa del usuario actual.
 * Incluye etapas (ordenadas) según el service.
 */
router.get('/',
    [
        query('limit')
            .optional()
            .isInt({ min: 1 })
            .withMessage('limit debe ser un entero >= 1'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('offset debe ser un entero >= 0'),
        query('filter')
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage('filter no puede ser vacío si se provee'),
        query('sortBy')
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage('sortBy no puede ser vacío si se provee'),
        query('sortDir')
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage('sortDir no puede ser vacío si se provee')
            .isIn(['asc', 'desc'])
            .withMessage('sortDir debe ser asc o desc')
    ],
    verifyRol(TF_ADMINS),
    VacanteController.getAll
)

router.post('/',
    [
        body('nombre')
            .exists().withMessage('nombre es requerido')
            .bail()
            .isString().withMessage('nombre debe ser string')
            .bail()
            .trim()
            .notEmpty().withMessage('nombre no puede ser vacío'),
        body('procesoId')
            .exists().withMessage('procesoId es requerido')
            .bail()
            .isUUID().withMessage('procesoId debe ser un UUID válido'),
        body('fechaInicio')
            .exists().withMessage('fechaInicio es requerido')
            .bail()
            .isISO8601({ strict: true }).withMessage('fechaInicio debe ser ISO-8601 (YYYY-MM-DD)')
            .bail()
            .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Use formato YYYY-MM-DD'),
        body('departamentoId')
            .exists().withMessage('departamentoId es requerido')
            .bail()
            .isUUID().withMessage('departamentoId debe ser un UUID válido'),
        body('sedeId')
            .exists().withMessage('sedeId es requerido')
            .bail()
            .isUUID().withMessage('sedeId debe ser un UUID válido'),
    ],
    verifyRol(TF_ADMINS),
    VacanteController.post
)

router.patch('/:id',
    [
        param('id').isUUID().withMessage('id debe ser un UUID válido'),
        body('nombre')
            .isString().withMessage('nombre debe ser string').bail()
            .trim().notEmpty().withMessage('nombre no puede ser vacío'),
        body('departamentoId')
            .isUUID().withMessage('departamentoId debe ser un UUID válido'),
        body('sedeId')
            .isUUID().withMessage('sedeId debe ser un UUID válido'),
        body('fechaInicio')
            .isISO8601({ strict: true }).withMessage('fechaInicio debe ser ISO-8601 (YYYY-MM-DD)').bail()
            .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Use formato YYYY-MM-DD'),
        body('estado')
            .isString().isIn(['abierta', 'pausada', 'cerrada', 'cancelada']),
    ],
    verifyRol(TF_ADMINS),
    VacanteController.patch
)

router.get('/estados',
    verifyRol(TF_ALL_ROLS),
    VacanteController.getResumenPorEstado
)

/**
 * GET /vacantes/:id
 * Obtiene una sede por ID (UUID).
 */
router.get(
    '/:id',
    verifyRol(TF_ALL_ROLS),
    [param('id').isUUID().withMessage('id debe ser un UUID válido')],
    VacanteController.getById
)

router.post('/completar-etapa',
    [
        body('id')
            .exists().withMessage('id es requerido')
            .bail()
            .isUUID().withMessage('id debe ser un UUID válido'),
        body('fechaCumplimiento')
            .exists().withMessage('fechaCumplimiento es requerido')
            .bail()
            .isISO8601({ strict: true }).withMessage('fechaCumplimiento debe ser ISO-8601 (YYYY-MM-DD)')
            .bail()
            .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Use formato YYYY-MM-DD'),
    ],
    verifyRol(TF_ADMINS),
    VacanteController.completarEtapa
)

export default router
