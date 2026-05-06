import HomeHeroForm from './HomeHeroForm'
import { getHomeHeroBannerSettings } from '@/lib/home-hero-banner'

export const dynamic = 'force-dynamic'

export default async function AdminHomeHeroPage() {
  const initial = await getHomeHeroBannerSettings()

  return <HomeHeroForm initial={initial} />
}
