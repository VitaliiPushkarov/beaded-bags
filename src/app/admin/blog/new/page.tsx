import BlogPostForm from '../BlogPostForm'

export default function AdminBlogNewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Нова стаття</h1>
        <p className="text-sm text-slate-600">
          Створіть чернетку або одразу опублікуйте статтю в блозі.
        </p>
      </div>

      <BlogPostForm mode="create" />
    </div>
  )
}
