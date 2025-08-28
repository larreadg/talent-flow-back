/** @typedef {import('@prisma/client').Usuario} Usuario */
/** @typedef {import('@prisma/client').Rol} Rol */

export const pick = (obj = {}, keys = []) => keys.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {})
export const appName = 'TalentFlow'

/**
 * Verificar si tiene un rol
 *
 * @param {{ id: string, rol: string, empresaId: string }} usuario
 * @param {string[]}  roles
 * @returns {boolean}
 */
export const hasRol = (usuario, roles) => {
    return roles.includes(usuario.rol) 
}

export const TF_SYS_ADMIN = ['TF_SYS_ADMIN']
export const TF_ADMINS = ['TF_SYS_ADMIN', 'TF_ADMIN']