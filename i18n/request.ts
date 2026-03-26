import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async () => {
  // 1. Check cookie first (user's explicit choice)
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined

  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    }
  }

  // 2. Fall back to Accept-Language header
  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  let detectedLocale: Locale = defaultLocale

  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map((part) => {
        const [lang, q] = part.trim().split(';q=')
        return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 }
      })
      .sort((a, b) => b.q - a.q)

    for (const { lang } of preferred) {
      if (locales.includes(lang as Locale)) {
        detectedLocale = lang as Locale
        break
      }
    }
  }

  return {
    locale: detectedLocale,
    messages: (await import(`../messages/${detectedLocale}.json`)).default,
  }
})
