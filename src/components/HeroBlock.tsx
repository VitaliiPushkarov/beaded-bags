import { getHomeHeroBannerSettings } from '@/lib/home-hero-banner'
import HeroBlockSlider from '@/components/HeroBlockSlider'

export default async function HeroBlock() {
  const hero = await getHomeHeroBannerSettings()

  return <HeroBlockSlider slides={hero.slides} />
}
