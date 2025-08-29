import dayjs from 'dayjs'
import { TalentFlowError } from '../utils/error.js'
import { prisma } from '../prismaClient.js'

const CAPTCHA_TTL_MIN = 5

export async function verifyCaptcha({ ip, challenge, from = 'login' }) {
  const cutoff = dayjs().subtract(CAPTCHA_TTL_MIN, 'minute').toDate()

  // Borra SOLO si coincide ip+challenge y no está vencido (fc >= cutoff).
  const { count } = await prisma.captcha.deleteMany({
    where: {
      ip,
      challenge,
      fc: { gte: cutoff },
    },
  })

  if (count === 0) {
    throw new TalentFlowError('Captcha inválida o vencida', from === 'login' ? 401 : 400)
  }

  return { ok: true }
}