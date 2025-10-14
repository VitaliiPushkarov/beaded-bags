import Image from 'next/image'

type AboutProps = {
  image: string // /images/about.png
  alt: string // "About us"
}

export default function About({ image, alt }: AboutProps) {
  return (
    <section className="w-full relative">
      <Image
        src={image}
        alt={alt}
        width={1440}
        height={600}
        className="w-full h-auto object-cover"
      />
    </section>
  )
}
