import { prisma } from '../src/prismaClient.js'

async function main() {
  // Ojo: asegurate de tener alguna empresa creada primero.
  // Por simplicidad, tomamos la primera empresa.
  const empresa = await prisma.empresa.findFirst({ where: { nombre: 'Universidad del Pacífico' } })
  if (!empresa) {
    throw new Error('No hay empresa creada. Crea al menos una antes de seedear etapas.')
  }

  const etapas = [
    { nombre: 'Difusión de la búsqueda', slaDias: 8 },
    { nombre: 'Evaluación de perfiles', slaDias: 4 },
    { nombre: 'Entrevista por competencias', slaDias: 7 },
    { nombre: 'Referencias laborales', slaDias: 2 },
    { nombre: 'Evaluación psicotécnica y comportamental', slaDias: 9 },
    { nombre: 'Remisión de informe (Reclutador)', slaDias: 2 },
    { nombre: 'Respuesta sobre informe (Solicitante)', slaDias: 1 },
    { nombre: 'Carta oferta', slaDias: 2 },
  ]

  await prisma.etapa.createMany({
    data: etapas.map((e) => ({
      empresaId: empresa.id,
      nombre: e.nombre,
      slaDias: e.slaDias,
      uc: 'seed', // opcional para auditoría
    })),
    skipDuplicates: true, // evita error si ya existen
  })

  console.log('Etapas seed creadas!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
