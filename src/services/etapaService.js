import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'

const ALLOWED_FIELDS = ['nombre', 'slaDias', 'activo']

/**
 * GET: Lista etapas de la empresa del usuario actual.
 * @param {Object} [opts]
 * @param {boolean} [opts.onlyActive]  Si true, filtra por activo=true
 * @returns {Promise<Array<Etapa>>}
 */
async function getByEmpresa(opts = {}) {
  try {
    const currentUser = getCurrentUser()

    const where = {
      empresaId: currentUser.empresaId,
      ...(opts.onlyActive ? { activo: true } : {}),
    }

    // Orden simple por nombre asc; ajusta si necesitas otro orden
    const etapas = await prisma.etapa.findMany({
      where,
      orderBy: { nombre: 'asc' },
    })

    return {
        data: etapas,
        meta: {
            total: etapas.length
        }
    }
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Etapa' })
  }
}

/**
 * POST: Crea una etapa para la empresa del usuario actual.
 * - Setea empresaId desde currentUser
 * - Controla unicidad (empresaId + nombre)
 * - Completa auditoría (uc, um)
 * @param {Partial<Etapa>} input
 * @returns {Promise<Etapa>}
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)

    // Validaciones mínimas (las duras pueden ir en express-validator)
    if (!data.nombre || !String(data.nombre).trim()) {
      throw new TalentFlowError('El nombre es obligatorio.', 400)
    }
    if (typeof data.slaDias !== 'number' || !Number.isInteger(data.slaDias) || data.slaDias < 0) {
      throw new TalentFlowError('slaDias debe ser un entero >= 0.', 400)
    }

    // Normalizaciones leves
    data.nombre = String(data.nombre).trim()
    if (!('activo' in data)) data.activo = true

    // Auditoría + empresa
    data.empresaId = currentUser.empresaId
    data.uc = currentUser.id
    data.um = currentUser.id

    // Unicidad (empresaId + nombre)
    const exists = await prisma.etapa.findFirst({
      where: { empresaId: data.empresaId, nombre: data.nombre },
      select: { id: true },
    })
    if (exists) {
      throw new TalentFlowError('Ya existe una etapa con ese nombre en esta empresa.', 409)
    }

    // Crear
    return await prisma.etapa.create({ data })
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Etapa' })
  }
}

export const EtapaService = {
  getByEmpresa,
  post,
}
