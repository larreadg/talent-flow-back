import { prisma } from '../prismaClient.js'
import { mapPrismaError, TalentFlowError } from '../utils/error.js'
import { getCurrentUser } from '../middlewares/requestContext.js'
import { pick } from '../utils/utils.js'

const ALLOWED_FIELDS = ['nombre', 'descripcion', 'etapas']
// etapas: Array<{ etapaId: string, orden: number }>

/**
 * GET: Lista procesos por empresa del usuario actual.
 * Incluye etapas del proceso ordenadas por `orden` y datos básicos de la Etapa.
 */
async function getByEmpresa() {
  try {
    const currentUser = getCurrentUser()

    const procesos = await prisma.proceso.findMany({
      where: { empresaId: currentUser.empresaId },
      orderBy: { nombre: 'asc' },
      include: {
        etapas: {
          orderBy: { orden: 'asc' },
          include: { etapa: { select: { nombre: true, slaDias: true } } }, // devuelve info de la Etapa (nombre, slaDias, etc.)
        },
      },
    })

    return {
        data: procesos,
        meta: {
            total: procesos.length
        }
    }
  } catch (e) {
    throw mapPrismaError(e, { resource: 'Proceso' })
  }
}

/**
 * POST: Crea un proceso y sus etapas (ProcesoEtapa) para la empresa del usuario actual.
 *
 * Body esperado:
 * - nombre: string (requerido)
 * - descripcion?: string
 * - etapas: Array<{ etapaId: string, orden: number }> (requerido, no vacío)
 *
 * Reglas:
 * - empresaId se toma de currentUser.
 * - nombre debe ser único por empresa (@@unique[empresaId, nombre]).
 * - etapas no puede estar vacío.
 * - orden debe ser entero >= 1.
 * - etapaId no debe repetirse dentro del array.
 * - orden no debe repetirse dentro del array.
 * - todas las etapas deben existir y pertenecer a la misma empresa del usuario.
 */
async function post(input = {}) {
  try {
    const currentUser = getCurrentUser()
    const data = pick(input, ALLOWED_FIELDS)

    // Validaciones mínimas (las fuertes podrían ir en express-validator)
    if (!data.nombre || !String(data.nombre).trim()) {
      throw new TalentFlowError('El nombre es obligatorio.', 400)
    }
    data.nombre = String(data.nombre).trim()

    if (!Array.isArray(data.etapas) || data.etapas.length === 0) {
      throw new TalentFlowError('Debe proveer al menos una etapa.', 400)
    }

    // Validar estructura de etapas + duplicados locales
    const etapaIds = []
    const ordenes = []
    for (const item of data.etapas) {
      if (!item || typeof item !== 'object') {
        throw new TalentFlowError('Cada etapa debe ser un objeto { etapaId, orden }.', 400)
      }
      const { etapaId, orden } = item
      if (!etapaId || typeof etapaId !== 'string') {
        throw new TalentFlowError('Cada etapa debe tener etapaId (UUID) válido.', 400)
      }
      if (!Number.isInteger(orden) || orden < 1) {
        throw new TalentFlowError('Cada etapa debe tener "orden" entero >= 1.', 400)
      }
      etapaIds.push(etapaId)
      ordenes.push(orden)
    }

    const maxOrden = Math.max(...ordenes)
    if (maxOrden !== ordenes.length) {
        throw new TalentFlowError('Los órdenes deben ser consecutivos empezando en 1.', 400)
    }

    // Duplicados de etapaId
    if (new Set(etapaIds).size !== etapaIds.length) {
      throw new TalentFlowError('No se permiten etapas repetidas (etapaId duplicado).', 400)
    }
    // Duplicados de orden
    if (new Set(ordenes).size !== ordenes.length) {
      throw new TalentFlowError('No se permiten órdenes repetidos.', 400)
    }

    // Unicidad de nombre por empresa (pre-chequeo para dar 409 limpio)
    const exists = await prisma.proceso.findFirst({
      where: { empresaId: currentUser.empresaId, nombre: data.nombre },
      select: { id: true },
    })
    if (exists) {
      throw new TalentFlowError('Ya existe un proceso con ese nombre en esta empresa.', 409)
    }

    // Validar que TODAS las etapas existan y pertenezcan a la misma empresa
    const etapasDb = await prisma.etapa.findMany({
      where: {
        empresaId: currentUser.empresaId,
        id: { in: etapaIds },
      },
      select: { id: true },
    })
    if (etapasDb.length !== etapaIds.length) {
      throw new TalentFlowError(
        'Una o más etapas no existen o no pertenecen a la empresa del usuario.',
        400
      )
    }

    // Crear proceso + procesoEtapas en transacción
    const created = await prisma.$transaction(async (tx) => {
      const proceso = await tx.proceso.create({
        data: {
          empresaId: currentUser.empresaId,
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
          activo: true,
          uc: currentUser.id,
          um: currentUser.id,
        },
      })

      // Crear cada ProcesoEtapa (createMany no devuelve filas; usamos create para auditar)
      for (const { etapaId, orden } of data.etapas) {
        await tx.procesoEtapa.create({
          data: {
            procesoId: proceso.id,
            etapaId,
            orden,
            uc: currentUser.id,
            um: currentUser.id,
          },
        })
      }

      // Devolver con etapas ya insertadas
      return tx.proceso.findUnique({
        where: { id: proceso.id },
        include: {
          etapas: {
            orderBy: { orden: 'asc' },
            include: { etapa: true },
          },
        },
      })
    })

    return created
  } catch (e) {
    if (e instanceof TalentFlowError) throw e
    throw mapPrismaError(e, { resource: 'Proceso' })
  }
}

export const ProcesoService = {
  getByEmpresa,
  post,
}
