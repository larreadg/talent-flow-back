// src/routes/sedeRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { SedeController } from '../controllers/sedeController.js'

/** @typedef {import('express').Router} Router */

// Valores permitidos de ordenamiento (deben coincidir con el service/controller)
const ORDER_FIELDS = ['nombre', 'ciudad', 'region', 'pais', 'fc', 'fm']

/**
 * Rutas para el recurso Sede.
 *
 * Convenciones:
 * - Validaciones con `express-validator` (los errores se manejan en el controller).
 * - Todas las rutas responden mediante el helper `Response` dentro del controller.
 *
 * @module routes/sede
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /sedes
 * Lista sedes con paginación, búsqueda y ordenamiento.
 *
 * Query params:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'nombre' | 'ciudad' | 'region' | 'pais' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - empresaId?: string (UUID)  ← opcional para filtrar por empresa
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('page debe ser entero >= 1'),
    query('pageSize').optional().isInt({ min: 1 }).toInt().withMessage('pageSize debe ser entero >= 1'),
    query('q').optional().isString().trim(),
    query('orderBy')
      .optional()
      .isIn(ORDER_FIELDS)
      .withMessage(`orderBy debe ser uno de: ${ORDER_FIELDS.join(', ')}`),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order debe ser asc o desc'),
    query('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
  ],
  SedeController.getAll
)

/**
 * GET /sedes/:id
 * Obtiene una sede por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  SedeController.getById
)

/**
 * GET /sedes/empresa/:empresaId
 * Lista sedes de una empresa específica.
 *
 * Path param:
 * - empresaId: string (UUID)
 *
 * Query params opcionales:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'ciudad' | 'region' | 'pais' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 */
router.get(
  '/empresa/:empresaId',
  [
    param('empresaId').isUUID().withMessage('empresaId debe ser un UUID válido'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  SedeController.getByEmpresa
)

/**
 * POST /sedes
 * Crea una nueva sede.
 *
 * Body:
 * - empresaId: string (UUID)  ← requerido
 * - nombre: string            ← requerido
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
 */
router.post(
  '/',
  [
    body('empresaId').notEmpty().withMessage('empresaId es requerido').bail().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('direccion').optional().isString().trim(),
    body('ciudad').optional().isString().trim(),
    body('region').optional().isString().trim(),
    body('pais').optional().isString().trim(),
    body('timezone').optional().isString().trim(),
  ],
  SedeController.post
)

/**
 * PATCH /sedes/:id
 * Actualiza parcialmente una sede existente.
 *
 * Body (cualquiera de estos campos):
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - direccion?: string
 * - ciudad?: string
 * - region?: string
 * - pais?: string
 * - timezone?: string
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').optional().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('direccion').optional().isString().trim(),
    body('ciudad').optional().isString().trim(),
    body('region').optional().isString().trim(),
    body('pais').optional().isString().trim(),
    body('timezone').optional().isString().trim(),
  ],
  SedeController.patch
)

/**
 * DELETE /sedes/:id
 * Elimina una sede por ID.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  SedeController.delete
)

export default router
