// src/routes/permisoRoute.js
import express from 'express'
import { query, param } from 'express-validator'
import { PermisoController } from '../controllers/permisoController.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['clave', 'recurso', 'accion', 'fc', 'fm']

/**
 * Rutas para el recurso Permiso.
 *
 * Convenciones:
 * - Validaciones con `express-validator` (los errores se manejan en el controller).
 * - Respuestas estandarizadas via `Response` dentro del controller.
 *
 * @module routes/permiso
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /permisos
 * Lista permisos con paginación, búsqueda y ordenamiento.
 *
 * Query params:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'clave' | 'recurso' | 'accion' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('page debe ser entero >= 1'),
    query('pageSize').optional().isInt({ min: 1 }).toInt().withMessage('pageSize debe ser entero >= 1'),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS).withMessage(`orderBy debe ser uno de: ${ORDER_FIELDS.join(', ')}`),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order debe ser asc o desc'),
  ],
  PermisoController.getAll
)

/**
 * GET /permisos/:id
 * Obtiene un permiso por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  PermisoController.getById
)

/**
 * GET /permisos/rol/:rolId
 * Lista permisos asociados a un rol específico.
 *
 * Path param:
 * - rolId: UUID
 *
 * Query params opcionales:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'clave' | 'recurso' | 'accion' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 */
router.get(
  '/rol/:rolId',
  [
    param('rolId').isUUID().withMessage('rolId debe ser un UUID válido'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  PermisoController.getByRol
)

export default router
