import express from 'express'
import { body, param, query } from 'express-validator'
import { DepartamentoController } from '../controllers/departamentoController.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['nombre', 'codigo', 'fc', 'fm']

/**
 * Rutas para el recurso Departamento (global por empresa).
 *
 * @module routes/departamento
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /departamentos
 * Lista departamentos con paginación, búsqueda y ordenamiento.
 *
 * Query params:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'nombre' | 'codigo' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - empresaId?: string (UUID) ← opcional para filtrar por empresa
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('page debe ser entero >= 1'),
    query('pageSize').optional().isInt({ min: 1 }).toInt().withMessage('pageSize debe ser entero >= 1'),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS).withMessage(`orderBy debe ser uno de: ${ORDER_FIELDS.join(', ')}`),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order debe ser asc o desc'),
    query('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
  ],
  DepartamentoController.getAll
)

/**
 * GET /departamentos/:id
 * Obtiene un departamento por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  DepartamentoController.getById
)

/**
 * GET /departamentos/empresa/:empresaId
 * Lista departamentos de una empresa específica.
 *
 * Path param:
 * - empresaId: string (UUID)
 *
 * Query opcionales:
 * - page?: number
 * - pageSize?: number
 * - q?: string
 * - orderBy?: 'nombre' | 'codigo' | 'fc' | 'fm'
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
  DepartamentoController.getByEmpresa
)

/**
 * POST /departamentos
 * Crea un departamento (global por empresa).
 *
 * Body:
 * - empresaId: string (UUID) ← requerido
 * - nombre: string           ← requerido
 * - codigo?: string
 * - parentId?: string (UUID)
 */
router.post(
  '/',
  [
    body('empresaId').notEmpty().withMessage('empresaId es requerido').bail().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('parentId').optional().isUUID().withMessage('parentId debe ser UUID'),
  ],
  DepartamentoController.post
)

/**
 * PATCH /departamentos/:id
 * Actualiza parcialmente un departamento.
 *
 * Body (cualquiera de estos campos):
 * - empresaId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - parentId?: string (UUID)
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('nombre').optional().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('parentId').optional().isUUID().withMessage('parentId debe ser UUID'),
  ],
  DepartamentoController.patch
)

/**
 * DELETE /departamentos/:id
 * Elimina un departamento por ID.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  DepartamentoController.delete
)

export default router
