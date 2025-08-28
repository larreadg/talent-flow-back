// scripts/seedEmpresaUsuarioRoles.js
import { prisma } from '../src/prismaClient.js'
import { randomBytes, scryptSync } from 'crypto'

/** ============================
 * Helpers
 * ============================ */
function hashPassword(plain) {
  if (!plain || typeof plain !== 'string') throw new Error('Password inválido')
  const N = 16384, r = 8, p = 1, keylen = 32
  const salt = randomBytes(16)
  const buf  = scryptSync(plain, salt, keylen, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${buf.toString('hex')}`
}

function genPassword(len = 16) {
  return randomBytes(Math.ceil((len * 3) / 4))
    .toString('base64')
    .replace(/[+/=]/g, '')
    .slice(0, len)
}

/** ============================
 * Datos de seed
 * ============================ */
const EMPRESA = {
  nombre: 'TalentFlow',
  razonSocial: 'TalentFlow',
  ruc: '0',
}

const ADMIN = {
  nombre: 'Diego',
  apellido: 'Larrea',
  telefono: '595972413798',
  email: 'larreadg@gmail.com',
  username: 'larreadg@gmail.com',
}

const ROLE_NAMES = ['TF_SYS_ADMIN', 'TF_ADMIN', 'TF_LECTOR']

/** ============================
 * Seed
 * ============================ */
async function main() {
  const plainPassword = process.env.ADMIN_PASSWORD || genPassword(16)

  // Empresa (idempotente)
  console.log('> Empresa: buscar/crear...')
  let empresa = await prisma.empresa.findFirst({
    where: { OR: [{ ruc: EMPRESA.ruc }, { nombre: EMPRESA.nombre }] },
  })
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: { ...EMPRESA, uc: 'seed', um: 'seed' },
    })
    console.log(`  ✓ Empresa creada: ${empresa.nombre} (id=${empresa.id})`)
  } else {
    console.log(`  • Empresa ya existe: ${empresa.nombre} (id=${empresa.id})`)
  }

  // Roles globales (upsert por nombre)
  console.log('> Roles (globales): upsert por nombre...')
  /** @type {Record<string, {id:string, nombre:string}>} */
  const roles = {}
  for (const nombre of ROLE_NAMES) {
    const rol = await prisma.rol.upsert({
      where: { nombre }, // requiere @@unique([nombre]) en Rol
      update: { descripcion: nombre, um: 'seed' },
      create: { nombre, descripcion: nombre, uc: 'seed', um: 'seed' },
    })
    roles[nombre] = { id: rol.id, nombre: rol.nombre }
  }
  console.log(`  ✓ Roles asegurados: ${ROLE_NAMES.join(', ')}`)

  // Usuario admin (crear/asegurar rol TF_SYS_ADMIN)
  console.log('> Usuario admin: buscar/crear...')
  let usuario = await prisma.usuario.findFirst({
    where: {
      empresaId: empresa.id,
      OR: [{ email: ADMIN.email }, { username: ADMIN.username }],
    },
  })

  if (!usuario) {
    usuario = await prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        rolId: roles['TF_SYS_ADMIN'].id, // asignar rol global
        departamentoId: null,
        sedeId: null,
        username: ADMIN.username,
        email: ADMIN.email,
        password: hashPassword(plainPassword),
        nombre: ADMIN.nombre,
        apellido: ADMIN.apellido,
        telefono: ADMIN.telefono,
        activo: true,
        uc: 'seed',
        um: 'seed',
      },
    })
    console.log(`  ✓ Usuario admin creado: ${usuario.username} (id=${usuario.id})`)
    console.log('  -------------------------------------------')
    console.log('  Credenciales iniciales:')
    console.log(`  username/email: ${ADMIN.email}`)
    console.log(`  password:       ${plainPassword}`)
    console.log('  -------------------------------------------')
  } else {
    if (usuario.rolId !== roles['TF_SYS_ADMIN'].id) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { rolId: roles['TF_SYS_ADMIN'].id, um: 'seed' },
      })
      console.log('  ✓ Rol del usuario actualizado a TF_SYS_ADMIN')
    } else {
      console.log('  • Usuario ya existe con rol TF_SYS_ADMIN')
    }
  }

  console.log('\nSeed finalizado ✅')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
