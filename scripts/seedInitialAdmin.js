// scripts/seedInitialAdmin.js
import { prisma } from '../src/prismaClient.js'
import { randomBytes, scryptSync } from 'crypto'

/* ==========================
 * Helpers de contraseña
 * ========================== */
function hashPassword(plain) {
  if (!plain || typeof plain !== 'string') throw new Error('Password inválido')
  const N = 16384, r = 8, p = 1, keylen = 32
  const salt = randomBytes(16)
  const buf = scryptSync(plain, salt, keylen, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${buf.toString('hex')}`
}

function genPassword(len = 16) {
  return randomBytes(Math.ceil((len * 3) / 4))
    .toString('base64')
    .replace(/[+/=]/g, '')
    .slice(0, len)
}

/* ==========================
 * Catálogo de permisos
 * ========================== */
const BASE_RESOURCES = [
  { key: 'empresa', name: 'Empresa' },
  { key: 'sede', name: 'Sede' },
  { key: 'departamento', name: 'Departamento' },
  { key: 'rol', name: 'Rol' },
  { key: 'permiso', name: 'Permiso' },
  { key: 'equipo', name: 'Equipo' },
  { key: 'usuario', name: 'Usuario' },
]

const CRUD = ['read', 'create', 'update', 'delete']

const basePermissions = BASE_RESOURCES.flatMap(r =>
  CRUD.map(a => ({
    clave: `${r.key}.${a}`,                // p.ej. empresa.read
    recurso: r.key,                        // empresa
    accion: a,                             // read
    descripcion: `${r.name}::${cap(a)}`,   // Empresa::Read (para UI)
  }))
)

const compositePermissions = [
  { clave: 'rol.permissions.update', recurso: 'rol', accion: 'permissions.update', descripcion: 'Rol::Permissions::Update' },
  { clave: 'usuario.roles.update', recurso: 'usuario', accion: 'roles.update', descripcion: 'Usuario::Roles::Update' },
  { clave: 'usuario.equipos.update', recurso: 'usuario', accion: 'equipos.update', descripcion: 'Usuario::Equipos::Update' },
]

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

/* ==========================
 * Seed
 * ========================== */
async function main() {
  const EMPRESA = {
    nombre: 'TalentFlow',
    razonSocial: 'TalentFlow',
    ruc: '0',
  }

  const ADMIN = {
    nombre: 'Diego',
    apellido: 'Larrea',
    telefono: '595972413798', // 12 dígitos, empieza con 595
    email: 'larreadg@gmail.com',
    username: 'larreadg@gmail.com',
  }

  const plainPassword = process.env.ADMIN_PASSWORD || genPassword(16)

  console.log('> Empresa: buscar/crear...')
  let empresa = await prisma.empresa.findFirst({ where: { ruc: EMPRESA.ruc } })
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: { ...EMPRESA, uc: 'seed', um: 'seed' },
    })
    console.log(`  ✓ Empresa creada: ${empresa.nombre} (id=${empresa.id})`)
  } else {
    console.log(`  • Empresa ya existe: ${empresa.nombre} (id=${empresa.id})`)
  }

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
    console.log(`  • Usuario ya existe: ${usuario.username} (id=${usuario.id})`)
  }

  console.log('> Permisos: upsert catálogo (usa clave)...')
  const permissions = [...basePermissions, ...compositePermissions]
  for (const p of permissions) {
    await prisma.permiso.upsert({
      where: { clave: p.clave },            // ← tu modelo tiene @@unique([clave])
      update: {
        recurso: p.recurso,
        accion: p.accion,
        descripcion: p.descripcion,
        um: 'seed',
      },
      create: {
        clave: p.clave,
        recurso: p.recurso,
        accion: p.accion,
        descripcion: p.descripcion,
        uc: 'seed',
        um: 'seed',
      },
    })
  }
  const allPerms = await prisma.permiso.findMany({ orderBy: { clave: 'asc' } })
  console.log(`  ✓ Permisos asegurados: ${allPerms.length}`)

  console.log('> Rol Admin: buscar/crear y vincular permisos...')
  let rolAdmin = await prisma.rol.findFirst({
    where: { empresaId: empresa.id, nombre: 'Admin' },
  })
  if (!rolAdmin) {
    rolAdmin = await prisma.rol.create({
      data: {
        empresaId: empresa.id,
        nombre: 'Admin',
        descripcion: 'Acceso total',
        uc: 'seed',
        um: 'seed',
      },
    })
    console.log(`  ✓ Rol Admin creado (id=${rolAdmin.id})`)
  } else {
    console.log(`  • Rol Admin ya existe (id=${rolAdmin.id})`)
  }

  // Vincular todos los permisos al rol Admin
  const existingRP = await prisma.rolPermiso.findMany({
    where: { rolId: rolAdmin.id },
    select: { permisoId: true },
  })
  const existingPIds = new Set(existingRP.map(x => x.permisoId))
  const missing = allPerms.filter(p => !existingPIds.has(p.id))

  if (missing.length) {
    await prisma.rolPermiso.createMany({
      data: missing.map(p => ({
        rolId: rolAdmin.id,
        permisoId: p.id,
        uc: 'seed',
        um: 'seed',
      })),
      skipDuplicates: true,
    })
    console.log(`  ✓ Permisos agregados al rol Admin: +${missing.length}`)
  } else {
    console.log('  • Rol Admin ya tenía todos los permisos')
  }

  console.log('> Asignar rol Admin al usuario...')
  await prisma.usuarioRol.createMany({
    data: [{
      usuarioId: usuario.id,
      rolId: rolAdmin.id,
      scopeSedeId: null,
      scopeDepartamentoId: null,
      scopeEquipoId: null,
      uc: 'seed',
      um: 'seed',
    }],
    skipDuplicates: true,
  })
  console.log('  ✓ Usuario tiene rol Admin')

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
