import express from 'express'
import { body, param, query } from 'express-validator'
import { EmpresaController } from '../controllers/empresaController.js'

/** @typedef {import('express').Router} Router */

/**
 * Rutas para el recurso Empresa.
 *
 * Convenciones:
 * - Validaciones con `express-validator` (los errores se manejan en el controller).
 * - Todas las rutas responden con el helper `Response` dentro del controller.
 *
 * @module routes/empresa
 * @returns {Router}
 */
const router = express.Router()

// Valores permitidos de ordenamiento (deben coincidir con el service)
const ORDER_FIELDS = ['nombre', 'razonSocial', 'ruc', 'fc', 'fm']

/**
 * GET /empresas
 * Lista empresas con paginación, búsqueda y ordenamiento.
 *
 * Query params:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'nombre' | 'razonSocial' | 'ruc' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
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
  ],
  EmpresaController.getAll
)

/**
 * GET /empresas/:id
 * Obtiene una empresa por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  EmpresaController.getById
)

/**
 * POST /empresas
 * Crea una nueva empresa.
 *
 * Body:
 * - nombre: string (requerido)
 * - razonSocial?: string
 * - ruc?: string
 * - estado?: string
 */
router.post(
  '/',
  [
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('razonSocial').optional().isString().trim(),
    body('ruc').optional().isString().trim(),
    body('estado').optional().isString().trim(),
  ],
  EmpresaController.post
)

/**
 * PATCH /empresas/:id
 * Actualiza parcialmente una empresa existente.
 *
 * Body (cualquiera de estos campos):
 * - nombre?: string
 * - razonSocial?: string
 * - ruc?: string
 * - estado?: string
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('nombre').optional().isString().trim(),
    body('razonSocial').optional().isString().trim(),
    body('ruc').optional().isString().trim(),
    body('estado').optional().isString().trim(),
  ],
  EmpresaController.patch
)

/**
 * DELETE /empresas/:id
 * Elimina una empresa por ID.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  EmpresaController.delete
)

export default router
