
import svgCaptcha from 'svg-captcha'
import { prisma } from '../prismaClient.js'
import { mapPrismaError } from '../utils/error.js'
import { LOWERCASE_NUM_PRESET } from '../utils/utils.js'

/**
 * Función que genera una captcha por ip
 * @param {Object} data Datos a insertar
 * @param {string} data.ip IP del usuario
 * @returns {Promise<unknown>}
 */
const generarCaptcha = async ({ ip }) => {

  try {
    const captchaImg = svgCaptcha.create({
      size: 6,
      noise: 4,
      width: 150,
      height: 50,
      background: "#fff",
      charPreset: LOWERCASE_NUM_PRESET,
    })

    const { text } = captchaImg

    await prisma.captcha.deleteMany({ where: { ip } })
    await prisma.captcha.create({
      data: {
        ip,
        challenge: text
      },
    })

    return captchaImg.data

  } catch (error) {
    throw mapPrismaError(e, { resource: 'Captcha' })
  }
 
}
export const CaptchaService = {
    generarCaptcha
}
