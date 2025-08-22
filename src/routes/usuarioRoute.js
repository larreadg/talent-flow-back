// src/routes/usuarioRoute.js
import express from 'express'
import { body, param, query } from 'express-validator'
import { UsuarioController } from '../controllers/usuarioController.js'

/** @typedef {import('express').Router} Router */

// Debe coincidir con el service (safeOrder)
const ORDER_FIELDS = ['username', 'email', 'nombre', 'apellido', 'fc', 'fm']

/**
 * Rutas para el recurso Usuario.
 *
 * @module routes/usuario
 * @returns {Router}
 */
const router = express.Router()

/**
 * GET /usuarios/empresa/:empresaId
 * Lista usuarios de una empresa con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - empresaId: UUID
 *
 * Query:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'username' | 'email' | 'nombre' | 'apellido' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - activo?: boolean
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
    query('activo').optional().isBoolean().toBoolean(),
    query('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
    query('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
  ],
  UsuarioController.getByEmpresa
)

/**
 * GET /usuarios/departamento/:departamentoId
 * Lista usuarios de un departamento con paginación, búsqueda y ordenamiento.
 *
 * Path param:
 * - departamentoId: UUID
 *
 * Query:
 * - page?: number (>=1)
 * - pageSize?: number (>=1)
 * - q?: string
 * - orderBy?: 'username' | 'email' | 'nombre' | 'apellido' | 'fc' | 'fm'
 * - order?: 'asc' | 'desc'
 * - activo?: boolean
 * - sedeId?: UUID
 */
router.get(
  '/departamento/:departamentoId',
  [
    param('departamentoId').isUUID().withMessage('departamentoId debe ser un UUID válido'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1 }).toInt(),
    query('q').optional().isString().trim(),
    query('orderBy').optional().isIn(ORDER_FIELDS).withMessage(`orderBy debe ser uno de: ${ORDER_FIELDS.join(', ')}`),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order debe ser asc o desc'),
    query('activo').optional().isBoolean().toBoolean(),
    query('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
  ],
  UsuarioController.getByDepartamento
)

/**
 * GET /usuarios/:id
 * Obtiene un usuario por ID (UUID).
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  UsuarioController.getById
)

/**
 * PATCH /usuarios/:id
 * Actualiza parcialmente un usuario.
 *
 * Body (cualquiera de estos campos; filtrado real en el service por ALLOWED_FIELDS):
 * - empresaId?: string (UUID)
 * - departamentoId?: string (UUID)
 * - sedeId?: string (UUID)
 * - nombre?: string
 * - apellido?: string
 * - telefono?: string
 */
router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('empresaId').optional().isUUID().withMessage('empresaId debe ser UUID'),
    body('departamentoId').optional().isUUID().withMessage('departamentoId debe ser UUID'),
    body('sedeId').optional().isUUID().withMessage('sedeId debe ser UUID'),
    body('nombre').optional().isString().trim(),
    body('apellido').optional().isString().trim(),
    body('telefono').optional().isString().trim(),
  ],
  UsuarioController.patch
)

/**
 * PATCH /usuarios/:id/roles
 * Agrega y/o quita roles a un usuario (con scopes opcionales).
 *
 * Body:
 * - add?: Array<{ rolId: UUID, scopeSedeId?: UUID, scopeDepartamentoId?: UUID, scopeEquipoId?: UUID, validFrom?: ISODate, validTo?: ISODate }>
 * - remove?: Array<UUID | { rolId: UUID, scopeSedeId?: UUID, scopeDepartamentoId?: UUID, scopeEquipoId?: UUID }>
 */
router.patch(
  '/:id/roles',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('add').optional().isArray().withMessage('add debe ser un array'),
    body('add.*.rolId').optional().isUUID().withMessage('rolId debe ser UUID'),
    body('add.*.scopeSedeId').optional().isUUID().withMessage('scopeSedeId debe ser UUID'),
    body('add.*.scopeDepartamentoId').optional().isUUID().withMessage('scopeDepartamentoId debe ser UUID'),
    body('add.*.scopeEquipoId').optional().isUUID().withMessage('scopeEquipoId debe ser UUID'),
    body('add.*.validFrom').optional().isISO8601().withMessage('validFrom debe ser fecha ISO'),
    body('add.*.validTo').optional().isISO8601().withMessage('validTo debe ser fecha ISO'),
    body('remove').optional().isArray().withMessage('remove debe ser un array'),
    // Nota: `remove` admite UUIDs o objetos; validación flexible para no bloquear casos mixtos
  ],
  UsuarioController.patchRoles
)

/**
 * PATCH /usuarios/:id/equipos
 * Agrega y/o quita equipos a un usuario.
 *
 * Body:
 * - add?: Array<{ equipoId: UUID, rolEnEquipo?: string, validFrom?: ISODate, validTo?: ISODate }>
 * - remove?: UUID[]
 */
router.patch(
  '/:id/equipos',
  [
    param('id').isUUID().withMessage('id debe ser un UUID válido'),
    body('add').optional().isArray().withMessage('add debe ser un array'),
    body('add.*.equipoId').optional().isUUID().withMessage('equipoId debe ser UUID'),
    body('add.*.rolEnEquipo').optional().isString().trim(),
    body('add.*.validFrom').optional().isISO8601().withMessage('validFrom debe ser fecha ISO'),
    body('add.*.validTo').optional().isISO8601().withMessage('validTo debe ser fecha ISO'),
    body('remove').optional().isArray().withMessage('remove debe ser un array'),
    body('remove.*').optional().isUUID().withMessage('IDs de remove deben ser UUID'),
  ],
  UsuarioController.patchEquipos
)

/**
 * DELETE /usuarios/:id
 * Desactiva (soft delete) un usuario.
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('id debe ser un UUID válido')],
  UsuarioController.delete
)

export default router
