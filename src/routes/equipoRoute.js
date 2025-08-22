// src/routes/equipoRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { EquipoController } from '../controllers/equipoController.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['nombre', 'codigo', 'tipo', 'fc', 'fm']

/**
 * Rutas para el recurso Equipo (scoped por empresa y sede).
 *
 * @module routes/equipo
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /equipos/empresa/:empresaId
 * Lista equipos de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: UUID
 *
 * Query:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'nombre' | 'codigo' | 'tipo' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - sedeId?: UUID
 * - departamentoId?: UUID
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
    query('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
    query('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
  ],
  EquipoController.getByEmpresa
)

/**
 * GET /equipos/:id
 * Obtiene un equipo por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  EquipoController.getById
)

/**
 * POST /equipos
 * Crea un nuevo equipo.
 *
 * Body:
 * - empresaId: string (UUID) ← requerido
 * - sedeId: string (UUID)    ← requerido
 * - departamentoId?: string (UUID)
 * - nombre: string           ← requerido
 * - codigo?: string
 * - tipo?: string
 */
router.post(
  '/',
  [
    body('empresaId').notEmpty().withMessage('empresaId es requerido').bail().isUUID().withMessage('empresaId debe ser UUID'),
    body('sedeId').notEmpty().withMessage('sedeId es requerido').bail().isUUID().withMessage('sedeId debe ser UUID'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
    body('nombre').notEmpty().withMessage('nombre es requerido').bail().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('tipo').optional().isString().trim(),
  ],
  EquipoController.post
)

/**
 * PATCH /equipos/:id
 * Actualiza parcialmente un equipo.
 *
 * Body (cualquiera de estos campos):
 * - empresaId?: string (UUID)
 * - sedeId?: string (UUID)
 * - departamentoId?: string (UUID)
 * - nombre?: string
 * - codigo?: string
 * - tipo?: string
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
    body('nombre').optional().isString().trim(),
    body('codigo').optional().isString().trim(),
    body('tipo').optional().isString().trim(),
  ],
  EquipoController.patch
)

/**
 * DELETE /equipos/:id
 * Elimina un equipo por ID.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  EquipoController.delete
)

export default router
