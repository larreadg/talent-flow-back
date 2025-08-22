// src/routes/rolRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { RolController } from '../controllers/rolController.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['nombre', 'fc', 'fm']

/**
 * Rutas para el recurso Rol (scoped por empresa).
 *
 * @module routes/rol
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /roles/empresa/:empresaId
 * Lista roles de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: UUID
 *
 * Query:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'nombre' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 */
router.get(
  '/empresa/:empresaId',
  [
    param('empresaId').isUUID().withMessage('empresaId debe ser un UUID válido'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS).withMessage(`orderBy debe ser uno de: ${ORDER_FIELDS.join(', ')}`),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order debe ser asc o desc'),
  ],
  RolController.getByEmpresa
)

/**
 * GET /roles/:id
 * Obtiene un rol por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  RolController.getById
)

/**
 * POST /roles
 * Crea un nuevo rol (scoped por empresa).
 *
 * Body:
 * - empresaId: string (UUID) ← requerido
 * - nombre: string           ← requerido
 * - descripcion?: string
 */
router.post(
  '/',
  [
    body('empresaId').notEmpty().withMessage('empresaId es requerido').bail().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('descripcion').optional().isString().trim(),
  ],
  RolController.post
)

/**
 * PATCH /roles/:id
 * Actualiza parcialmente un rol.
 *
 * Body (cualquiera de estos campos):
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - descripcion?: string
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').optional().isString().trim(),
    body('descripcion').optional().isString().trim(),
  ],
  RolController.patch
)

/**
 * PATCH /roles/:id/permisos
 * Agrega y/o quita permisos a un rol.
 *
 * Body:
 * - add?: string[]    → IDs (UUID) de permisos a agregar
 * - remove?: string[] → IDs (UUID) de permisos a quitar
 */
router.patch(
  '/:id/permisos',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('add').optional().isArray().withMessage('add debe ser un arreglo'),
    body('add.*').optional().isUUID().withMessage('cada elemento de add debe ser UUID'),
    body('remove').optional().isArray().withMessage('remove debe ser un arreglo'),
    body('remove.*').optional().isUUID().withMessage('cada elemento de remove debe ser UUID'),
  ],
  RolController.patchPermisos
)

/**
 * DELETE /roles/:id
 * Elimina un rol por ID.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  RolController.delete
)

export default router
