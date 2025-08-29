import { prisma } from '../prismaClient.js'
import { mapPrismaError } from '../utils/error.js'

/** @typedef {import('@prisma/client').Rol} Rol */

/**
 * Lista roles
 * @returns {Promise<Rol[]>}
 * Resultado Lista roles
 * @throws {import('../utils/error.js').TalentFlowError}
 */
async function get() {
  try {
    return await prisma.rol.findMany({ where: { nombre: { in: ['ADMIN', 'LECTOR'] } }, select: { nombre: true, id: true } })
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Rol' })
  }
}

export const RolService = {
  get
}
