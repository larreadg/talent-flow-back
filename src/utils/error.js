import { Prisma } from '@prisma/client'

export class TalentFlowError extends Error {
  /**
   * @param {string} message
   * @param {number} [code=500] - HTTP status code
   */
  constructor(message, code = 500) {
    super(message)
    this.code = code
  }
}

/**
 * Extrae detalles útiles (modelo/campos) desde e.meta para construir mensajes legibles.
 * @param {any} e
 * @returns {{target?: string, model?: string}}
 */
function extractMeta(e) {
  const target = Array.isArray(e?.meta?.target)
    ? e.meta.target.join(', ')
    : e?.meta?.target || e?.meta?.field_name || undefined
  const model = e?.meta?.modelName || e?.meta?.model || undefined
  return { target, model }
}

/**
 * Mapeo genérico de errores Prisma → TalentFlowError (HTTP).
 * Úsalo en TODOS los servicios.
 *
 * @param {unknown} error - Error capturado
 * @param {{ resource?: string }} [opts] - Nombre del recurso para mensajes 404 (ej: 'Empresa')
 * @returns {TalentFlowError}
 */
export function mapPrismaError(error, { resource = 'Recurso' } = {}) {
  if (error instanceof TalentFlowError) return error

  // ---- Errores "conocidos" con código P2xxx
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const code = error.code
    const { target, model } = extractMeta(error)

    switch (code) {
      // --- Conflictos de integridad / unicidad
      case 'P2002': // Unique constraint failed
        return new TalentFlowError(
          `Violación de unicidad${target ? ` en (${target})` : ''}${model ? ` del modelo ${model}` : ''}.`,
          409
        )
      case 'P2003': // Foreign key constraint failed
      case 'P2011': // Null constraint violation
      case 'P2014': // The change would violate the required relation
      case 'P2017': // Records not connected
        return new TalentFlowError('Conflicto de integridad referencial.', 409)

      // --- No encontrado
      case 'P2001': // Record not found (where)
      case 'P2015': // Related record not found
      case 'P2018': // Required connected records not found
      case 'P2025': // Record not found (update/delete)
        return new TalentFlowError(`${resource} no encontrado.`, 404)

      // --- Datos inválidos / fuera de rango / faltantes
      case 'P2000': // Value too long
      case 'P2005': // Invalid value for field
      case 'P2006': // Invalid value for field type
      case 'P2007': // Data validation error
      case 'P2012': // Missing required value
      case 'P2013': // Missing required argument
      case 'P2019': // Input error
      case 'P2020': // Value out of range
        return new TalentFlowError('Datos inválidos o con formato incorrecto.', 422)

      // --- Errores de consulta (parsing/validation)
      case 'P2008': // Query parsing error
      case 'P2009': // Query validation error
      case 'P2016': // Query interpretation error
      case 'P2027': // Multiple errors occurred on the database
      case 'P2033': // Invalid number of parameters (varía por versión)
        return new TalentFlowError('Error en la consulta.', 400)

      // --- Timeouts / concurrencia
      case 'P2024': // Operation timed out
        return new TalentFlowError('Timeout al consultar la base de datos.', 503)

      // --- Estructura DB / características no soportadas
      case 'P2021': // Table not found
      case 'P2022': // Column not found
      case 'P2023': // Inconsistent column data
      case 'P2028': // Transaction API error
        return new TalentFlowError('Error interno de base de datos.', 500)
      case 'P2026': // Unsupported feature of the database
        return new TalentFlowError('Funcionalidad no soportada por la base de datos.', 501)

      default:
        return new TalentFlowError(error.message || 'Error de base de datos.', 500)
    }
  }

  // ---- Otros tipos de error del cliente Prisma
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new TalentFlowError('Parámetros inválidos para la consulta.', 400)
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    // Ej: credenciales inválidas, DB inaccesible, etc.
    return new TalentFlowError('Fallo al inicializar la conexión a la base de datos.', 503)
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new TalentFlowError('Pánico interno del motor de base de datos.', 500)
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new TalentFlowError('Error desconocido al consultar la base de datos.', 500)
  }

  // ---- Fallback (errores no Prisma u otros)
  const message = (/** @type {{ message?: string }} */(error))?.message || 'Error interno'
  const status = (/** @type {{ code?: number }} */(error))?.code
  return new TalentFlowError(message, Number.isInteger(status) ? /** @type {number} */(status) : 500)
}
